import { useEffect, useRef, useState, type FormEvent } from 'react';  
import {  
  CalendarDays,  
  ChevronDown,  
  ChevronUp,  
  MapPin,  
  Upload,  
} from 'lucide-react';  
  
const asset = (filename: string) => `${import.meta.env.BASE_URL}assets/${filename}`;  
  
// ===== FECHA DE LA BODA — cambia SOLO aquí y se actualiza todo =====  
const WEDDING = { year: 2027, month: 3, day: 13, hour: 19 }; // month: 3 = Marzo, hour: 19 = 7 PM  
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];  
const dos = (n: number) => String(n).padStart(2, '0');  
const WEDDING_DATE = new Date(WEDDING.year, WEDDING.month - 1, WEDDING.day, WEDDING.hour);  
const mesNombre = MESES[WEDDING.month - 1];  
const fechaPunteada = `${dos(WEDDING.day)}.${dos(WEDDING.month)}.${WEDDING.year}`;  
  
const mapUrl =  
  'https://www.google.com/maps/search/?api=1&query=Quinta+El+Ed%C3%A9n%2C+Paseo+de+las+Gardenias+602%2C+Nueva+Castilla%2C+Escobedo%2C+Nuevo+Le%C3%B3n';  
  
function downloadCalendar() {  
  const pad = (n: number) => String(n).padStart(2, '0');  
  const fechaICS = `${WEDDING.year}${pad(WEDDING.month)}${pad(WEDDING.day)}`;  
  const inicio = `${fechaICS}T${pad(WEDDING.hour)}0000`;  
  const fin = `${fechaICS}T${pad(WEDDING.hour + 4)}0000`;  
  const calendar = [  
    'BEGIN:VCALENDAR',  
    'VERSION:2.0',  
    'PRODID:-//Angela y Robert//Invitacion de boda//ES',  
    'CALSCALE:GREGORIAN',  
    'BEGIN:VEVENT',  
    `UID:angela-robert-${fechaICS}@invitacion.local`,  
    `DTSTAMP:${fechaICS}T120000Z`,  
    `DTSTART;TZID=America/Monterrey:${inicio}`,  
    `DTEND;TZID=America/Monterrey:${fin}`,  
    'SUMMARY:Boda de Angela Palmerston y Robert Wilson',  
    'LOCATION:Quinta El Edén\\, P.º de las Gardenias 602\\, Nueva Castilla\\, Cd. Gral. Escobedo\\, N.L.',  
    'DESCRIPTION:Ceremonia y recepción. Invitación para María y Pablo.',  
    'END:VEVENT',  
    'END:VCALENDAR',  
  ].join('\r\n');  
  const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });  
  const url = URL.createObjectURL(blob);  
  const link = document.createElement('a');  
  link.href = url;  
  link.download = `angela-y-robert-${WEDDING.day}-${mesNombre.toLowerCase()}-${WEDDING.year}.ics`;  
  document.body.appendChild(link);  
  link.click();  
  link.remove();  
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);  
}
  
const faqs = [  
  {  
    question: '¿Los niños están invitados?',  
    answer:  
      'La invitación está dirigida a las personas indicadas en cada pase. Si tienen alguna duda sobre sus lugares reservados, pueden comunicarse directamente con Angela y Robert.',  
  },  
  {  
    question: '¿Hay estacionamiento en el lugar?',  
    answer:  
      'La invitación no incluye información confirmada sobre estacionamiento. Les recomendamos considerar el tiempo de traslado y consultar cualquier detalle de acceso con sus anfitriones.',  
  },  
];  
  
function getTimeLeft(target: number) {  
  const diff = Math.max(0, target - Date.now());  
  const days = Math.floor(diff / 86400000);  
  const hours = Math.floor((diff % 86400000) / 3600000);  
  const minutes = Math.floor((diff % 3600000) / 60000);  
  const seconds = Math.floor((diff % 60000) / 1000);  
  return [  
    [String(days).padStart(2, '0'), 'DÍAS'],  
    [String(hours).padStart(2, '0'), 'HORAS'],  
    [String(minutes).padStart(2, '0'), 'MINUTOS'],  
    [String(seconds).padStart(2, '0'), 'SEGUNDOS'],  
  ] as const;  
}  
type Slide = { file: string; key: string };  
  
const isVideoFile = (f: string) => /\.(mp4|webm|mov)$/i.test(f);  
  
function PhotoCarousel({ slides }: { slides: Slide[] }) {  
  const track = useRef<HTMLDivElement>(null);  
  const pauseUntil = useRef(0);  
  
  useEffect(() => {  
    if (slides.length < 2) return; // una sola imagen o video => no rota  
    const timer = window.setInterval(() => {  
      const el = track.current;  
      if (!el || Date.now() < pauseUntil.current) return;  
      const w = el.clientWidth;  
      const next = Math.round(el.scrollLeft / w) + 1;  
      el.scrollTo({ left: next >= slides.length ? 0 : next * w, behavior: 'smooth' });  
    }, 3000);  
    return () => window.clearInterval(timer);  
  }, [slides.length]);  
  
  const holdForSwipe = () => { pauseUntil.current = Date.now() + 4000; };  
  
  return (  
    <section style={{ width: '100%' }}>  
      <div  
        ref={track}  
        onTouchStart={holdForSwipe}  
        onScroll={holdForSwipe}  
        style={{  
          display: 'flex',  
          overflowX: 'auto',  
          scrollSnapType: 'x mandatory',  
          scrollbarWidth: 'none',  
          msOverflowStyle: 'none',  
          WebkitOverflowScrolling: 'touch',  
        }}  
      >  
        {slides.map((s) =>  
          isVideoFile(s.file) ? (  
            <video  
              key={s.key}  
              data-key={s.key}  
              src={asset(s.file)}  
              autoPlay  
              loop  
              muted  
              playsInline  
              preload="auto"  
              style={{ minWidth: '100%', width: '100%', aspectRatio: '1.17', height: 'auto', objectFit: 'cover', display: 'block', scrollSnapAlign: 'start' }}  
            />  
          ) : (  
            <img  
              key={s.key}  
              data-key={s.key}  
              src={asset(s.file)}  
              alt="Angela y Robert"  
              style={{ minWidth: '100%', width: '100%', aspectRatio: '1.17', height: 'auto', objectFit: 'cover', display: 'block', scrollSnapAlign: 'start' }}  
            />  
          ),  
        )}  
      </div>  
      <style>{`.invite-shell section div::-webkit-scrollbar{display:none}`}</style>  
    </section>  
  );  
}  
function App() {  
  const [envelopeOpen, setEnvelopeOpen] = useState(false);  
  const [openFaq, setOpenFaq] = useState<number | null>(null);  
  const [preview, setPreview] = useState('');  
  const [albumQueue, setAlbumQueue] = useState<{ f: File; progress: number; status: 'pendiente' | 'subiendo' | 'listo' | 'error' }[]>([]);  
  const [uploading, setUploading] = useState(false);  
  const albumInput = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});  
  const [confirmOpen, setConfirmOpen] = useState(false);  
  const [modifyOpen, setModifyOpen] = useState(false);  
  const [thanks, setThanks] = useState<null | 'yes' | 'no'>(null);  
  const [rsvpDone, setRsvpDone] = useState(false);  
  const pendingForm = useRef<FormData | null>(null);
   
  useEffect(() => {  
    fetch('/api/content').then((r) => r.json()).then(({ content = {} }) => {  
      const flat: Record<string, string> = {};  
      for (const [k, v] of Object.entries(content) as [string, { value: string }][]) flat[k] = v.value;  
      setCfg(flat);  
    }).catch(() => {});  
    fetch(`/api/guests/check/${encodeURIComponent('María y Pablo')}`).then((r) => r.json())  
      .then(({ guest }) => { if (guest) setRsvpDone(true); }).catch(() => {});  
  }, []);  
  
  const eventDate = cfg.cfg_date ? new Date(cfg.cfg_date) : WEDDING_DATE;  
  const eDay = eventDate.getDate();  
  const eMes = MESES[eventDate.getMonth()];  
  const eYear = eventDate.getFullYear();  
  const eFechaPunteada = `${dos(eDay)}.${dos(eventDate.getMonth() + 1)}.${eYear}`;  
  
  const targetDate = eventDate.getTime();  
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));  
  
  useEffect(() => {  
    const timer = window.setInterval(() => {  
      setTimeLeft(getTimeLeft(targetDate));  
    }, 1000);  
    return () => window.clearInterval(timer);  
  }, [targetDate]); 
  useEffect(() => {  
    document.body.classList.toggle('invite-open', envelopeOpen);  
  }, [envelopeOpen]);
  
  const openInvitation = () => {  
    setEnvelopeOpen(true);  
    window.setTimeout(() => {  
      document.getElementById('invitation-start')?.scrollIntoView({  
        behavior: 'smooth',  
        block: 'start',  
      });  
    }, 360);  
  };  
  
 const sendRsvp = async (form: FormData) => {  
    const res = await fetch('/api/guests', {  
      method: 'POST',  
      headers: { 'content-type': 'application/json' },  
      body: JSON.stringify({  
        name: 'María y Pablo',  
        attendance: String(form.get('attendance') || 'yes'),  
        passes: Number(form.get('people')) || 0,  
        message: String(form.get('message') || '').trim(),  
        source: 'form',  
      }),  
    });  
    if (!res.ok) throw new Error('No se pudo enviar.');  
  };  
  
  const doConfirm = async () => {  
    if (!pendingForm.current) return;  
    const attendance = String(pendingForm.current.get('attendance') || 'yes');  
    try {  
      await sendRsvp(pendingForm.current);  
      setConfirmOpen(false);  
      setThanks(attendance === 'yes' ? 'yes' : 'no');  
      setRsvpDone(true);  
    } catch {  
      setConfirmOpen(false);  
      setPreview('No se pudo enviar. Intenta de nuevo.');  
    }  
  };  
const uploadToDrive = async () => {  
    const url = cfg.cfg_drive_url;  
    if (!url) { setPreview('Configura la URL de subida en administración.'); return; }  
    setUploading(true);  
    for (let i = 0; i < albumQueue.length; i++) {  
      const item = albumQueue[i];  
      setAlbumQueue((prev) => prev.map((p, j) => (j === i ? { ...p, status: 'subiendo' } : p)));  
      try {  
        const base64 = await new Promise<string>((resolve, reject) => {  
          const r = new FileReader();  
          r.onload = () => resolve(String(r.result).split(',')[1]);  
          r.onerror = () => reject(new Error('No se pudo leer.'));  
          r.readAsDataURL(item.f);  
        });  
        const res = await fetch(url, {  
          method: 'POST',  
          headers: { 'content-type': 'text/plain' },  
          body: JSON.stringify({ name: item.f.name, type: item.f.type, data: base64 }),  
        });  
        if (!res.ok) throw new Error('Fallo');  
        setAlbumQueue((prev) => prev.map((p, j) => (j === i ? { ...p, status: 'listo' } : p)));  
      } catch {  
        setAlbumQueue((prev) => prev.map((p, j) => (j === i ? { ...p, status: 'error' } : p)));  
      }  
    }  
    setUploading(false);  
  };  
    
  const previewRsvp = (event: FormEvent<HTMLFormElement>) => {  
    event.preventDefault();  
    if (rsvpDone) { setModifyOpen(true); return; }  
    pendingForm.current = new FormData(event.currentTarget);  
    setConfirmOpen(true);  
  };  
  
  return (  
    <main className="invite-shell" data-testid="page-wedding-invitation">  
      <section className="cover" aria-label="Invitación personalizada">  
        <div className="cover-names">  
          <div className="cover-name" data-testid="text-bride-name">  
            <span className="script" data-key="bride_initial">A</span>  
            <span className="cover-name-text">  
              <span className="given-name" data-key="bride_first_name">NGELA</span>  
              <span className="surname" data-key="bride_last_name">PALMERSTON</span>  
            </span>  
          </div>  
          <div className="cover-name" data-testid="text-groom-name">  
            <span className="script" data-key="groom_initial">R</span>  
            <span className="cover-name-text">  
              <span className="given-name" data-key="groom_first_name">OBERT</span>  
              <span className="surname" data-key="groom_last_name">WILSON</span>  
            </span>  
          </div>  
        </div>  
        <span className="cover-and script" data-key="cover_and">and</span>  
        <div className="ornament-rule cover-separator" aria-hidden="true">  
          <span>✤</span>  
        </div>  
        <p className="cover-date serif">MONTERREY, NL | {eFechaPunteada}</p>  
  
        <button  
          className={`envelope-button${envelopeOpen ? ' is-open' : ''}`}  
          type="button"  
          onClick={openInvitation}  
          aria-label="Abrir invitación"  
          data-testid="button-open-invitation"  
        >  
          <img className="envelope-base" data-key="envelope_base_img" src={asset('envelope-base.png')} alt="" />  
          <img className="envelope-flower top" data-key="envelope_flower_top" src={asset('florals-sprig.png')} alt="" />  
          <img className="envelope-flower bottom" data-key="envelope_flower_bottom" src={asset('florals-bouquet.png')} alt="" />  
        </button>  
        <div className="envelope-hint" data-key="envelope_hint">CLIC EN EL SOBRE PARA ABRIR INVITACIÓN</div>  
        <div className="ornament-rule" aria-hidden="true" style={{ marginTop: 8 }}>  
          <span>✤</span>  
        </div>  
        <p className="guest-name script" data-key="guest_names" data-testid="text-invitee-names">María y Pablo</p>  
        <p className="guest-reserved" data-key="guest_reserved">HEMOS RESERVADO</p>  
        <p className="guest-count" data-key="guest_count">2</p>  
        <p className="guest-caption" data-key="guest_caption">LUGARES A TU NOMBRE</p>  
      </section>
      {envelopeOpen && (<>
  
      <section className="video-still" id="invitation-start" aria-label="Recuerdo de Angela y Robert">  
        <video  
          data-key="video_still_img"  
          src={asset('pdfimg-000.png')}  
          autoPlay  
          loop  
          muted  
          playsInline  
          preload="auto"  
          style={{ width: '100%', height: 'auto', display: 'block' }}  
        />  
      </section>  
  
      <section className="olive-section blessing">  
        <p className="eyebrow" data-key="blessing_eyebrow">CON LA BENDICIÓN DE DIOS Y EL CARIÑO DE<br />NUESTROS PADRES</p>  
        <div className="parents-block">  
          <h3 data-key="bride_parents_title">PADRES DE LA NOVIA</h3>  
          <p data-key="bride_parent_1">MARIBEL TORRES BALDERAS</p>  
          <p data-key="bride_parent_2">JOSÉ ELÍAS ALVARADO CORPUS</p>  
        </div>  
        <div className="parents-block">  
          <h3 data-key="groom_parents_title">PADRES DEL NOVIO</h3>  
          <p data-key="groom_parent_1">JULIETA GUZMAN VICHELIN</p>  
          <p data-key="groom_parent_2">SAMUEL JOEL CERVANTES</p>  
        </div>  
      </section>  
  
      <section className="paper-section">  
        <h1 className="couple-heading script" data-key="couple_heading" data-testid="text-couple-names">  
          Angela Palmerston <small>y</small> Robert Wilson  
        </h1>  
        <p className="section-copy" data-key="invite_intro">  
          QUEREMOS COMPARTIR CONTIGO LA ALEGRÍA DE CELEBRAR NUESTRA BODA  
        </p>  
        <div  
          style={{  
            position: 'relative',  
            width: 'min(100%, 340px)',  
            margin: '18px auto 22px',  
          }}  
        >  
          <img  
            src={asset('sobre.png')}  
            data-key="save_date_envelope_img"  
            alt="Sobre de Angela y Robert"  
            style={{ width: '100%', height: 'auto', display: 'block' }}  
          />  
  
          <div  
            style={{  
              position: 'absolute',  
              top: '75%',  
              left: '79%',  
              transform: 'translate(-50%, -50%)',  
              width: '26%',  
              display: 'flex',  
              flexDirection: 'column',  
              alignItems: 'center',  
              justifyContent: 'center',  
              textAlign: 'center',  
              color: '#5d6e43',  
            }}  
          >  
            <span data-key="save_date_label_1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 12, letterSpacing: '.09em' }}>Reserva</span>  
            <span data-key="save_date_label_2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 12, letterSpacing: '.09em' }}>ESTA FECHA</span>  
            <span className="serif" style={{ fontSize: 38, lineHeight: 0.9 }}>{eDay}</span>  
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15 }}>{eMes}</span>  
            <span style={{ fontSize: 12, letterSpacing: '.1em' }}>{eYear}</span>  
          </div>  
  
          <button  
            className="outline-button"  
            type="button"  
            onClick={downloadCalendar}  
            data-testid="button-add-calendar"  
            style={{ position: 'absolute', left: '0%', bottom: '4%', fontSize: 10, padding: '6px 9px' }}  
          >  
            <CalendarDays size={14} /> AGENDAR EN CALENDARIO  
          </button>  
        </div>  
      </section>  
  
      <section  
        className="countdown"  
        aria-label="Cuenta regresiva"  
        style={{ position: 'relative', overflow: 'hidden', padding: '48px 24px', textAlign: 'center' }}  
      >  
        <img  
          src={asset('roses-countdown.webp')}  
          data-key="countdown_bg_img"  
          alt=""  
          aria-hidden="true"  
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}  
        />  
        <div style={{ position: 'relative', zIndex: 1 }}>  
          <h2 className="countdown-heading" data-key="countdown_heading" style={{ color: '#4a3f2f' }}>SOLO FALTAN</h2>  
          <p className="countdown-label" style={{ color: '#6b5d4a' }}>  
            {eDay} · {eMes.toUpperCase()} · {eYear}  
          </p>  
          <div  
            className="countdown-grid"  
            data-testid="status-countdown-live"  
            style={{ display: 'flex', justifyContent: 'center', gap: 9, flexWrap: 'wrap' }}  
          >  
            {timeLeft.map(([value, label]) => (  
              <div  
                key={label}  
                style={{  
                  minWidth: 69,  
                  padding: '11px 8px 8px',  
                  background: 'rgba(255,255,255,0.85)',  
                  borderRadius: 8,  
                  color: '#4a3f2f',  
                }}  
              >  
                <strong style={{ display: 'block', fontSize: 31, fontWeight: 600, lineHeight: 1 }}>{value}</strong>  
                <span style={{ display: 'block', marginTop: 6, fontSize: 9, letterSpacing: '.1em' }}>{label}</span>  
              </div>  
            ))}  
          </div>  
        </div>  
      </section>  
  
      <PhotoCarousel  
        slides={[  
          { file: 'couple-veil.webp', key: 'carousel_faltan_1' },  
          { file: 'pdfimg-010.jpg', key: 'carousel_faltan_2' },  
          { file: 'pdfimg-002.jpg', key: 'carousel_faltan_3' },  
        ]}  
      />  
  
      <section className="paper-section venue-section">  
        <h2 className="script-title" data-key="venue_title">Ceremonia <span className="serif">&</span> Recepción</h2>  
        <img className="venue-image" data-key="venue_image" src={asset('pdfimg-011.jpg')} alt="Jardines y arquitectura de la Quinta El Edén" />  
        <h3 className="venue-name" data-key="venue_name">QUINTA EL EDÉN</h3>  
        <p className="venue-time" data-key="venue_time">7:00 PM</p>  
        <p className="venue-address" data-key="venue_address">  
          P.º de las Gardenias 602, Nueva Castilla,<br />  
          66052 Cd. Gral. Escobedo, N.L.  
        </p>  
        <a className="olive-button" href={cfg.cfg_location_url || mapUrl} target="_blank" rel="noreferrer" data-testid="link-venue-map">  
          <MapPin size={14} /> <span data-key="venue_button_text">VER UBICACIÓN</span>  
        </a>  
      </section>
        <PhotoCarousel  
        slides={[  
          { file: 'couple-veil.webp', key: 'carousel_ubicacion_1' },  
          { file: 'pdfimg-011.jpg', key: 'carousel_ubicacion_2' },  
          { file: 'pdfimg-003.jpg', key: 'carousel_ubicacion_3' },  
        ]}  
      />
  
      <section className="dress-section">  
        <h2 className="dress-title"><span data-key="dress_title_1">CÓDIGO DE</span><strong data-key="dress_title_2">Vestimenta</strong></h2>  
        <p className="dress-copy" data-key="dress_copy">  
          FORMAL<br />  
          TAMBIÉN PUEDES OPTAR POR ESTILO VAQUERO ELEGANTE.<br />  
          EL COLOR BLANCO Y BEIGE ESTÁN RESERVADOS PARA LA NOVIA.<br />  
          PARA CABALLEROS, EL TRAJE BEIGE ESTÁ RESERVADO PARA EL NOVIO.  
        </p>  
        <p className="inspiration-label" data-key="inspiration_women_label">INSPIRACIÓN MUJERES</p>  
        <div className="inspiration-grid">  
          <div>  
            <img src={asset('pdfimg-010.jpg')} data-key="women_inspiration_img_1" alt="Inspiración de vestimenta formal" />  
            <span data-key="women_inspiration_caption_1">FORMAL · ELEGANTE</span>  
          </div>  
          <div>  
            <img src={asset('pdfimg-002.jpg')} data-key="women_inspiration_img_2" alt="Inspiración de vestimenta para la celebración" />  
            <span data-key="women_inspiration_caption_2">TONOS DE TEMPORADA</span>  
          </div>  
        </div>  
        <p className="inspiration-label" data-key="inspiration_men_label">INSPIRACIÓN HOMBRES</p>  
        <div className="inspiration-grid">  
          <div>  
            <img src={asset('pdfimg-003.jpg')} data-key="men_inspiration_img_1" alt="Traje formal para caballero" />  
            <span data-key="men_inspiration_caption_1">TRAJE FORMAL</span>  
          </div>  
          <div>  
            <img src={asset('pdfimg-010.jpg')} data-key="men_inspiration_img_2" alt="Inspiración de vestimenta formal para caballero" />  
            <span data-key="men_inspiration_caption_2">ESTILO VAQUERO ELEGANTE</span>  
          </div>  
        </div>  
      </section>  
  
      <section className="itinerary">  
        <h2 className="script-title" data-key="itinerary_title">Itinerario</h2>  
        <div className="itinerary-list">  
          <div className="itinerary-row">  
            <span className="itinerary-time" data-key="itinerary_time_1">8:00 PM</span>  
            <span className="itinerary-event" data-key="itinerary_event_1">RECEPCIÓN</span>  
          </div>  
          <div className="itinerary-row">  
            <span className="itinerary-time" data-key="itinerary_time_2">9:00 PM</span>  
            <span className="itinerary-event" data-key="itinerary_event_2">CENA</span>  
          </div>  
          <div className="itinerary-row">  
            <span className="itinerary-time" data-key="itinerary_time_3">10:00 PM</span>  
            <span className="itinerary-event" data-key="itinerary_event_3">CELEBRACIÓN</span>  
          </div>  
        </div>  
      </section>  
  
      <section className="gift-section">  
        <h2 className="dress-title"><span data-key="gift_title_1">SUGERENCIA DE</span><strong data-key="gift_title_2">Regalo</strong></h2>  
        <p className="gift-copy" data-key="gift_copy">  
          COMPARTIR ESTE DÍA CON USTEDES ES EL REGALO MÁS VALIOSO PARA NOSOTROS.  
          NO OBSTANTE, SI DESEAN TENER UN DETALLE ADICIONAL, AGRADECERÍAMOS QUE  
          SEA A TRAVÉS DE  
        </p>  
        <p className="gift-highlight" data-key="gift_highlight">NUESTRA LLUVIA DE SOBRES<br />EL DÍA DEL EVENTO</p>  
        <div className="photo-album">  
          <p data-key="album_copy">COMPARTE TUS FOTOS Y LOS MOMENTOS MÁS ESPECIALES USANDO NUESTRO ÁLBUM DE FOTOS</p>  
          <input  
            ref={albumInput}  
            type="file"  
            accept="image/*,video/*"  
            multiple  
            hidden  
            aria-label="Elegir una foto para el álbum"  
            data-testid="input-photo-upload"  
            onChange={(event) => {  
              const files = Array.from(event.target.files ?? []);  
              setAlbumQueue((prev) => [...prev, ...files.map((f) => ({ f, status: 'pendiente' }))]);  
              event.target.value = '';  
            }}  
          />  
          <button className="olive-button light" type="button" onClick={() => albumInput.current?.click()} data-testid="button-photo-upload">  
            <Upload size={14} /> <span data-key="album_button_text">CARGAR</span>  
          </button>  
          {albumQueue.length > 0 && (  
            <>  
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', fontSize: 12, textAlign: 'left' }}>  
                {albumQueue.map((q, i) => (  
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0' }}>  
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.f.name}</span>  
                    <span>{q.status === 'listo' ? '✓ listo' : q.status === 'error' ? '✗ error' : q.status === 'subiendo' ? 'subiendo…' : 'pendiente'}</span>  
                  </li>  
                ))}  
              </ul>  
              <button className="olive-button" type="button" disabled={uploading} onClick={uploadToDrive}>  
                {uploading ? 'SUBIENDO…' : 'SUBIR A DRIVE'}  
              </button>  
            </>  
          )}  
        </div>  
      </section>
        <PhotoCarousel  
        slides={[  
          { file: 'couple-veil.webp', key: 'carousel_regalo_1' },  
          { file: 'pdfimg-010.jpg', key: 'carousel_regalo_2' },  
          { file: 'pdfimg-002.jpg', key: 'carousel_regalo_3' },  
        ]}  
      />
  
      <section className="faq-section">  
        <h2 className="script-title" data-key="faq_title">Recomendaciones <span className="serif">& FAQ</span></h2>  
        <p className="faq-intro" data-key="faq_intro">  
          <strong>RECEPCIÓN</strong><br />  
          SE RECOMIENDA LLEGAR 30 MINUTOS ANTES<br />  
          CONSIDERAR TRÁFICO Y DISTANCIA  
        </p>  
        <div className="faq-list">  
          {faqs.map((faq, index) => {  
            const expanded = openFaq === index;  
            return (  
              <div className="faq-item" key={faq.question}>  
                <button  
                  className="faq-question"  
                  type="button"  
                  aria-expanded={expanded}  
                  onClick={() => setOpenFaq(expanded ? null : index)}  
                  data-testid={`button-faq-${index + 1}`}  
                >  
                  <span data-key={`faq_question_${index + 1}`}>{faq.question}</span>  
                  {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}  
                </button>  
                {expanded && <p className="faq-answer" data-key={`faq_answer_${index + 1}`}>{faq.answer}</p>}  
              </div>  
            );  
          })}  
        </div>  
      </section>  
  
      <section className="rsvp-section" id="rsvp">  
        <h2 className="script-title" data-key="rsvp_title" style={{ color: '#fffaf4' }}>RSVP</h2>  
        <div className="rsvp-panel">  
          <p className="eyebrow" data-key="rsvp_eyebrow_1">AGRADECEMOS CONFIRMAR SU<br />ASISTENCIA ANTES DEL</p>  
          <p className="rsvp-date" data-key="rsvp_date">23 DE MAYO DE 2026</p>  
          <p className="eyebrow" data-key="rsvp_eyebrow_2">MEDIANTE EL SIGUIENTE FORMULARIO</p>  
          <form className="rsvp-form" onSubmit={previewRsvp}>  
            <div className="rsvp-field">  
              <label htmlFor="guest-name" data-key="rsvp_label_name">NOMBRE DEL INVITADO</label>  
              <input id="guest-name" name="guestName" defaultValue="María y Pablo" readOnly data-testid="input-rsvp-name" />  
            </div>  
            <p className="rsvp-note" data-key="rsvp_note">ESTA INVITACIÓN CUENTA CON 2 PASES.<br />UNA SOLA PERSONA DEBE CONFIRMAR LA ASISTENCIA.</p>  
            <div className="rsvp-field">  
              <label htmlFor="attendance" data-key="rsvp_label_attendance">CONFIRMACIÓN</label>  
              <select id="attendance" name="attendance" defaultValue="yes" data-testid="select-rsvp-attendance">  
                <option value="yes">CONFIRMO MI ASISTENCIA</option>  
                <option value="no">NO PODRÉ ACOMPAÑARLES</option>  
              </select>  
            </div>  
            <div className="rsvp-field">  
              <label htmlFor="people" data-key="rsvp_label_people">NÚMERO DE PASES</label>  
              <select id="people" name="people" defaultValue="2" data-testid="select-rsvp-seats">  
                <option value="1">1 PERSONA</option>  
                <option value="2">2 PERSONAS</option>  
              </select>  
            </div>  
            <div className="rsvp-field">  
              <label htmlFor="message" data-key="rsvp_label_message">MENSAJE PARA LOS NOVIOS</label>  
              <textarea id="message" name="message" data-testid="input-rsvp-message" />  
            </div>  
            <button className="olive-button light" type="submit" data-testid="button-rsvp-preview">  
              <span data-key="rsvp_button_text">CONFIRMAR</span>  
            </button>  
            {preview && <p className="preview-message" role="status" data-testid="status-rsvp-preview">{preview}</p>}  
            <p className="preview-caption" data-key="rsvp_preview_caption">TU CONFIRMACIÓN SERÁ ENVIADA A LOS NOVIOS.</p>  
          </form>  
          <div style={{ marginTop: 22 }}>  
            <p className="eyebrow" data-key="whatsapp_eyebrow">RSVP POR WHATSAPP</p>  
            <p className="preview-caption" data-key="whatsapp_caption">TAMBIÉN PUEDES CONFIRMAR TU ASISTENCIA A TRAVÉS DEL SIGUIENTE ENLACE DE WHATSAPP</p>  
            <button  
              className="olive-button light"  
              type="button"  
              onClick={async () => {  
                const num = window.prompt('Escribe tu número de WhatsApp (con código de país):');  
                if (!num) return;  
                const name = (document.getElementById('guest-name') as HTMLInputElement)?.value || 'Invitado';  
                try {  
                  await fetch('/api/guests', {  
                    method: 'POST',  
                    headers: { 'content-type': 'application/json' },  
                    body: JSON.stringify({ name: `${name} (${num})`, phone: num, source: 'whatsapp', attendance: '', passes: 0, message: '' }),  
                  });  
                } catch { /* seguir a WhatsApp igual */ }  
                const dest = (cfg.cfg_whatsapp || '').replace(/\D/g, '');  
                window.open(`https://wa.me/${dest}?text=${encodeURIComponent(`Hola, soy ${name}. Confirmo mi asistencia.`)}`, '_blank');  
              }}  
              style={{ marginTop: 13 }}  
            >  
              <span data-key="whatsapp_button_text">CONFIRMAR ASISTENCIA</span>  
            </button>  
            <p className="preview-caption" data-key="whatsapp_note">Enlace de WhatsApp no configurado; la acción solo muestra esta nota.</p>  
          </div>  
        </div>  
      </section>  
  
      <section className="closing">  
        <img src={asset('pdfimg-003.jpg')} data-key="closing_img" alt="" />  
        <div className="closing-content">  
          <p data-key="closing_text">AGRADECEMOS PROFUNDAMENTE SU PRESENCIA Y SUS MUESTRAS DE CARIÑO EN NUESTRO DÍA ESPECIAL.</p>  
          <p className="script" data-key="closing_names">Angela y Robert</p>  
        </div>  
      </section>
      {confirmOpen && (  
        <div className="rsvp-modal" role="dialog">  
          <div className="rsvp-modal-card">  
            <p className="script-title">¿Está seguro de la información que enviará?</p>  
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>  
              <button className="olive-button light" type="button" onClick={doConfirm}>SÍ</button>  
              <button className="outline-button" type="button" onClick={() => setConfirmOpen(false)}>NO</button>  
            </div>  
          </div>  
        </div>  
      )}  
      {modifyOpen && (  
        <div className="rsvp-modal" role="dialog">  
          <div className="rsvp-modal-card">  
            <p className="script" style={{ fontSize: 40, margin: 0 }}>☺</p>  
            <p className="script-title">¿Desea modificar su respuesta?</p>  
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>  
              <button className="olive-button light" type="button" onClick={() => { setRsvpDone(false); setModifyOpen(false); }}>SÍ</button>  
              <button className="outline-button" type="button" onClick={() => setModifyOpen(false)}>NO</button>  
            </div>  
          </div>  
        </div>  
      )}  
      {thanks && (  
        <div className="rsvp-modal" role="dialog">  
          <div className="rsvp-modal-card">  
            <img data-key={thanks === 'yes' ? 'confirm_image_yes' : 'confirm_image_no'} src={asset(thanks === 'yes' ? 'pdfimg-010.jpg' : 'pdfimg-002.jpg')} alt="" style={{ width: '100%', borderRadius: 8 }} />  
            <p className="script-title" data-key={thanks === 'yes' ? 'confirm_thanks_yes' : 'confirm_thanks_no'}>  
              {thanks === 'yes' ? '¡GRACIAS POR CONFIRMAR TU ASISTENCIA!' : '¡GRACIAS POR AVISARNOS!'}  
            </p>  
            <button className="olive-button light" type="button" onClick={() => setThanks(null)}>CERRAR</button>  
          </div>  
        </div>  
      )}
      <footer className="footer-note" data-key="footer_note">CON CARIÑO, ANGELA &amp; ROBERT · {fechaPunteada}</footer>  
        </>)}
      </main>  
  );  
}  
  
export default App;
