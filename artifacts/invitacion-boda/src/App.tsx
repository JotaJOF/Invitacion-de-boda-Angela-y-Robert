import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';  
import {    
  CalendarDays,    
  ChevronDown,    
  ChevronUp,    
  MapPin,    
  Pause,  
  Play,  
  Upload,    
} from 'lucide-react';  
  
const asset = (filename: string) => `${import.meta.env.BASE_URL}assets/${filename}`;  
  
// ===== FECHA DE LA BODA — cambia SOLO aquí y se actualiza todo =====  
const WEDDING = { year: 2027, month: 3, day: 1, hour: 18 }; // month: 3 = Marzo, hour: 19 = 7 PM  
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
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      const el = track.current;
      if (!el || Date.now() < pauseUntil.current) return;
      const w = el.clientWidth;
      const next = Math.round(el.scrollLeft / w) + 1;
      const target = next >= slides.length ? 0 : next;
      el.scrollTo({ left: target * w, behavior: 'smooth' });
      setActiveIdx(target);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const handleScroll = () => {
    pauseUntil.current = Date.now() + 4000;
    const el = track.current;
    if (el && el.clientWidth) {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx !== activeIdx && idx >= 0 && idx < slides.length) {
        setActiveIdx(idx);
      }
    }
  };

  return (
    <section style={{ width: '100%', position: 'relative' }}>
      <div
        ref={track}
        onTouchStart={() => { pauseUntil.current = Date.now() + 4000; }}
        onScroll={handleScroll}
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
      {slides.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: '9999px',
            background: 'rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        >
          {slides.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === activeIdx ? '16px' : '6px',
                height: '6px',
                borderRadius: '9999px',
                background: i === activeIdx ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>
      )}
      <style>{`.invite-shell section div::-webkit-scrollbar{display:none}`}</style>
    </section>
  );
}


function getWeddingSlug(): string {
  if (typeof window === 'undefined') return 'angela-robert';
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!path || path === 'index.html' || path === 'admin.html' || path === 'invitados.html') {
    return 'angela-robert';
  }
  return path.toLowerCase();
}

function displayGivenName(value: string | undefined, initial: string, fallback: string) {
  const name = (value || fallback).trim();
  const first = initial.trim();
  return first && name.toLocaleUpperCase().startsWith(first.toLocaleUpperCase())
    ? name.slice(first.length).trimStart()
    : name;
}

function App() {  
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  
  const [openFaq, setOpenFaq] = useState<number | null>(null);  
  const [preview, setPreview] = useState('');  
  const [albumQueue, setAlbumQueue] = useState<{ id: string; f: File; status: 'pendiente' | 'subiendo' | 'listo' | 'error'; progress: number }[]>([]);  
  const [uploading, setUploading] = useState(false);  
  const albumInput = useRef<HTMLInputElement>(null);
  // Never paint stale cached names/styles before the server returns this wedding's content.
  const [cfg, setCfg] = useState<Record<string, string>>({});

  const dynamicCss = useMemo(() => {
    let css = "";
    for (const [k, v] of Object.entries(cfg)) {
      if (k.endsWith("__style") && v) {
        try {
          const s = JSON.parse(v);
          const baseKey = k.replace(/__style$/, "");
          const rules: string[] = [];
          if (s.fontFamily) rules.push(`font-family: ${s.fontFamily} !important;`);
          if (s.fontSize) rules.push(`font-size: ${s.fontSize} !important;`);
          if (s.maxWidth) rules.push(`max-width: ${s.maxWidth} !important;`);
          if (s.width) rules.push(`width: ${s.width} !important;`);
          if (s.display) rules.push(`display: ${s.display} !important;`);
          if (s.whiteSpace) rules.push(`white-space: ${s.whiteSpace} !important;`);
          if (s.transform) rules.push(`transform: ${s.transform} !important;`);
          if (s.marginLeft) rules.push(`margin-left: ${s.marginLeft} !important;`);
          if (s.marginRight) rules.push(`margin-right: ${s.marginRight} !important;`);
          if (s.marginTop) rules.push(`margin-top: ${s.marginTop} !important;`);
          if (s.marginBottom) rules.push(`margin-bottom: ${s.marginBottom} !important;`);
          if (rules.length) {
            css += `#root [data-key="${baseKey}"] { ${rules.join(" ")} }\n`;
          }
        } catch {}
      }
    }
    return css;
  }, [cfg]);
  const [contentReady, setContentReady] = useState(false);
  const inviteCode = new URLSearchParams(window.location.search).get('c') || '';  
  const [invitee, setInvitee] = useState<{ name: string; max_passes: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);  
  const [modifyOpen, setModifyOpen] = useState(false);  
  const [thanks, setThanks] = useState<null | 'yes' | 'no'>(null);  
  const [rsvpDone, setRsvpDone] = useState(false);  
  const pendingForm = useRef<FormData | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);  
  const [musicPlaying, setMusicPlaying] = useState(false);
  const slug = getWeddingSlug();
  const isMain = slug === 'angela-robert';

  // No loading state
  const [loading] = useState(false);
   
  useEffect(() => {  
    const slug = getWeddingSlug();
    fetch(`/api/content?wedding=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la invitación.");
        return r.json();
      })
      .then(({ content = {} }) => {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(content) as [string, { value: string }][]) flat[k] = v.value;
        setCfg(flat);
        try { localStorage.setItem("wedding_content_" + slug, JSON.stringify(flat)); } catch {}
      })
      .catch(() => {
        // La caché solo se usa después de fallar la lectura, nunca antes de ella.
        try {
          const raw = localStorage.getItem("wedding_content_" + slug);
          if (raw) setCfg(JSON.parse(raw));
        } catch {}
      })
      .finally(() => setContentReady(true));  

    if (inviteCode) {  
      fetch(`/api/invite/${encodeURIComponent(inviteCode)}`).then((r) => r.json())  
        .then(({ guest }) => {  
          if (!guest) return;  
          setInvitee(guest);  
          if (guest.attendance) setRsvpDone(true);  
        }).catch(() => {});  
    }  
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
    audioRef.current?.play().then(() => setMusicPlaying(true)).catch(() => {});  
    window.setTimeout(() => {  
      const target = document.getElementById('invitation-start');  
      if (!target) return;  
      const startY = window.scrollY;  
      const distance = target.getBoundingClientRect().top;  
      const duration = 1600;  
      let startTime: number | null = null;  
      const ease = (t: number) =>  
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;  
      const step = (now: number) => {  
        if (startTime === null) startTime = now;  
        const progress = Math.min((now - startTime) / duration, 1);  
        window.scrollTo({ top: startY + distance * ease(progress), behavior: 'instant' as ScrollBehavior });  
        if (progress < 1) window.requestAnimationFrame(step);  
      };  
      window.requestAnimationFrame(step);  
    }, 900);  
  };
useEffect(() => {  
    if (!envelopeOpen) return;  
    const sections = document.querySelectorAll('.invite-shell section');  
    sections.forEach((s) => s.classList.add('reveal'));  
    const io = new IntersectionObserver((entries) => {  
      entries.forEach((e) => {  
        if (e.isIntersecting) {  
          e.target.classList.add('reveal-in');  
          io.unobserve(e.target);  
        }  
      });  
    }, { threshold: 0.15 });  
    sections.forEach((s) => io.observe(s));  
    return () => io.disconnect();  
  }, [envelopeOpen]);
  useEffect(() => {  
    if (!envelopeOpen) return;  
    const a = audioRef.current;  
    if (a && a.paused) {  
      a.play().then(() => setMusicPlaying(true)).catch(() => {});  
    }  
  }, [envelopeOpen]);  
  
 const sendRsvp = async (form: FormData) => {  
    const res = await fetch('/api/guests', {  
      method: 'POST',  
      headers: { 'content-type': 'application/json' },  
      body: JSON.stringify({  
        name: invitee?.name || 'Invitado',  
        code: inviteCode,  
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
    if (!url) { setPreview('Configura la carpeta de Drive desde el panel de administración.'); return; }  
    if (!albumQueue.length) return;  
    setUploading(true);  
    const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {  
      const r = new FileReader();  
      r.onload = () => resolve(String(r.result).split(',')[1]);  
      r.onerror = reject;  
      r.readAsDataURL(file);  
    });  
    const patch = (id: string, p: Partial<{ progress: number; status: string }>) =>  
      setAlbumQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));  
    for (const item of albumQueue) {  
      if (item.status === 'listo') continue;  
      patch(item.id, { status: 'subiendo' });  
      try {  
        const base64 = await fileToBase64(item.f);  
        await fetch(url, {  
          method: 'POST',  
          mode: 'no-cors',  
          headers: { 'content-type': 'text/plain' },  
          body: JSON.stringify({ name: item.f.name, type: item.f.type, data: base64 }),  
        });  
        patch(item.id, { status: 'listo' });  
      } catch {  
        patch(item.id, { status: 'error' });  
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
  
  

  if (!contentReady) return null;

  return (  
    <main className="invite-shell" data-testid="page-wedding-invitation">
      {dynamicCss ? <style id="dynamic-content-styles" dangerouslySetInnerHTML={{ __html: dynamicCss }} /> : null}  
      <section className="cover" aria-label="Invitación personalizada" data-bg="cover">  
        <div className="cover-names">  
          <div className="cover-name" data-testid="text-bride-name">  
            <span className="script" data-key="bride_initial">{cfg['bride_initial'] ?? (isMain ? 'a' : (slug.split('-')[1]?.charAt(0).toUpperCase() || ''))}</span>  
            <span className="cover-name-text">  
              <span className="given-name" data-key="bride_first_name">{displayGivenName(cfg['bride_first_name'], cfg['bride_initial'] ?? (isMain ? 'a' : (slug.split('-')[1]?.charAt(0).toUpperCase() || '')), isMain ? 'ANGELA' : '')}</span>  
              <span className="surname" data-key="bride_last_name">{cfg['bride_last_name'] ?? (isMain ? 'PALMERSTON' : '')}</span>  
            </span>  
          </div>  
          <div className="cover-name" data-testid="text-groom-name">  
            <span className="script" data-key="groom_initial">{cfg['groom_initial'] ?? (isMain ? 'R' : (slug.split('-')[0]?.charAt(0).toUpperCase() || ''))}</span>  
            <span className="cover-name-text">  
              <span className="given-name" data-key="groom_first_name">{displayGivenName(cfg['groom_first_name'], cfg['groom_initial'] ?? (isMain ? 'R' : (slug.split('-')[0]?.charAt(0).toUpperCase() || '')), isMain ? 'ROBERT' : '')}</span>  
              <span className="surname" data-key="groom_last_name">{cfg['groom_last_name'] ?? (isMain ? 'WILSON' : '')}</span>  
            </span>  
          </div>  
        </div>  
        <span className="cover-and script" data-key="cover_and">and</span>  
        <div className="ornament-rule cover-separator" aria-hidden="true">  
          <span>✤</span>  
        </div>  
        <p className="cover-date serif"><span data-key="cover_place">{cfg['cover_place'] || 'Casa Jardín Eventos'}</span> | <span data-key="cover_date_fmt" data-style-only="1">{eFechaPunteada}</span></p>  
  
        <button  
          className={`envelope-button${envelopeOpen ? ' is-open' : ''}`}  
          type="button"  
          onClick={openInvitation}  
          aria-label="Abrir invitación"  
          data-testid="button-open-invitation"  
        >  
          <img className="envelope-base" data-key="envelope_base_img" src={cfg['envelope_base_img'] || asset('sobre.png')} alt="" />  
          <img className="envelope-flower top" data-key="envelope_flower_top" src={cfg['envelope_flower_top'] || asset('florals-sprig.png')} alt="" />  
          <img className="envelope-flower bottom" data-key="envelope_flower_bottom" src={cfg['envelope_flower_bottom'] || asset('florals-bouquet.png')} alt="" />  
        </button>  
        <div className="envelope-hint" data-key="envelope_hint">CLIC EN EL SOBRE PARA ABRIR INVITACIÓN</div>  
        <div className="ornament-rule" aria-hidden="true" style={{ marginTop: 8 }}>  
          <span>✤</span>  
        </div>  
        <p className="guest-name script" data-key="guest_names" data-testid="text-invitee-names">{invitee?.name ?? 'María y Pablo'}</p>  
        <p className="guest-reserved" data-key="guest_reserved">HEMOS RESERVADO</p>  
        <p className="guest-count" data-key="guest_count">{invitee?.max_passes || 2}</p>  
        <p className="guest-caption" data-key="guest_caption">LUGARES A TU NOMBRE</p>  
      </section>
      {envelopeOpen && (<>
  
      <section className="video-still" id="invitation-start" aria-label="Recuerdo de Angela y Robert">  
        {/\.(mp4|webm|mov)$/i.test(String(cfg['video_still_img'] || 'pdfimg-000.png')) ? (  
          <video  
            data-key="video_still_img"  
            src={asset(String(cfg['video_still_img'] || 'pdfimg-000.png'))}  
            autoPlay  
            loop  
            muted  
            playsInline  
            preload="auto"  
            style={{ width: '100%', height: 'auto', display: 'block' }}  
          />  
        ) : (  
          <img  
            data-key="video_still_img"  
            src={asset(String(cfg['video_still_img'] || 'pdfimg-000.png'))}  
            alt="Recuerdo de Angela y Robert"  
            style={{ width: '100%', height: 'auto', display: 'block' }}  
          />  
        )}  
      </section>  
  
      <section className="olive-section blessing" data-bg="padres">  
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
  
      <section className="paper-section" data-bg="portada">  
        <h1 className="couple-heading script" data-key="couple_heading" data-testid="text-couple-names">  
          {cfg['couple_heading'] ? (
            cfg['couple_heading']
          ) : getWeddingSlug() === 'angela-robert' ? (
            <>Angela Palmerston <small>y</small> Robert Wilson</>
          ) : (
            getWeddingSlug().split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' y ')
          )}
        </h1>  
        <p className="section-copy" data-key="invite_intro">  
          QUEREMOS COMPARTIR CONTIGO LA ALEGRÍA DE CELEBRAR NUESTRA BODA  
        </p>  
        <div    
          className="save-date-wrapper"    
          style={{    
            position: 'relative',    
            width: 'min(100%, 350px)',  
            margin: '22px auto 14px',  
          }}  
        >
          <img
            src={asset('sobre.png')}
            data-key="save_date_envelope_img"
            alt="Sobre de Angela y Robert"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 14px 28px rgba(67, 56, 47, 0.12))',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          <div  
            className="save-date-badge"  
            style={{  
              position: 'absolute',  
              top: '74%',  
              left: '79%',  
              transform: 'translate(-50%, -50%)',  
              width: '30%',  
              display: 'flex',  
              flexDirection: 'column',  
              alignItems: 'center',  
              justifyContent: 'center',  
              textAlign: 'center',  
              color: '#526339',  
              gap: '6px',  
              lineHeight: 1.15,  
              pointerEvents: 'auto',  
              zIndex: 5,  
            }}  
          >
            <span
              data-key="save_date_label_1"
              style={{
                width: '100%',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(11px, 2.7vw, 13px)',
                letterSpacing: '.06em',
                fontStyle: 'italic',
                opacity: 0.9,
              }}
            >
              Reserva
            </span>
            <span  
              data-key="save_date_label_2"    
              style={{  
                width: '100%',  
                fontFamily: "'Montserrat', sans-serif",  
                fontSize: 'clamp(8px, 2.1vw, 9.5px)',  
                letterSpacing: '.14em',  
                fontWeight: 600,  
                opacity: 0.85,  
              }}  
            >  
              ESTA FECHA  
            </span>
            <span    
              className="serif"    
              data-key="save_date_day"    
              data-style-only="1"    
              style={{    
                width: '100%',    
                padding: '4px 0',  
                fontSize: 'clamp(28px, 7.8vw, 36px)',    
                fontWeight: 600,    
                lineHeight: 1,    
                color: '#3d4b27',    
                margin: '2px 0 1px',    
              }}    
            >    
              {eDay}    
            </span>
            <span    
              data-key="save_date_month"    
              data-style-only="1"    
              style={{    
                width: '100%',    
                padding: '4px 0',  
                fontFamily: "'Cormorant Garamond', serif",    
                fontSize: 'clamp(13px, 3.4vw, 15px)',    
                letterSpacing: '.08em',    
                textTransform: 'uppercase',    
                fontWeight: 500,    
              }}    
            >    
              {eMes}    
            </span>
            <span    
              data-key="save_date_year"    
              data-style-only="1"    
              style={{    
                width: '100%',    
                padding: '4px 0',  
                fontSize: 'clamp(10px, 2.5vw, 11.5px)',    
                letterSpacing: '.12em',    
                opacity: 0.85,    
              }}    
            >    
              {eYear}    
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
          <button
            className="outline-button"
            type="button"
            onClick={downloadCalendar}
            data-testid="button-add-calendar"
            style={{
              padding: '11px 24px',
              fontSize: '11px',
              letterSpacing: '.1em',
            }}
          >
            <CalendarDays size={14} /> <span data-key="calendar_button_text">AGENDAR EN CALENDARIO</span>
          </button>
        </div>
      </section>  
  
      <section
        className="countdown"
        aria-label="Cuenta regresiva"
        style={{ position: 'relative', overflow: 'hidden', padding: '52px 20px', textAlign: 'center' }}
      >
        <img
          src={asset('roses-countdown.webp')}
          data-key="countdown_bg_img"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, filter: 'saturate(0.9) brightness(0.95)' }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="countdown-heading" data-key="countdown_heading" style={{ color: '#3d3428', letterSpacing: '.18em', fontSize: '1.4rem' }}>SOLO FALTAN</h2>
          <p className="countdown-label" data-key="countdown_date" data-style-only="1" style={{ color: '#685949', letterSpacing: '.14em', margin: '6px 0 24px', fontSize: '0.82rem', fontWeight: 500 }}>
            {eDay} · {eMes.toUpperCase()} · {eYear}
          </p>
          <div
            className="countdown-grid"
            data-testid="status-countdown-live"
            style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', maxWidth: '380px', margin: '0 auto' }}
          >
            {timeLeft.map(([value, label]) => (
              <div
                key={label}
                className="countdown-card"
                style={{
                  flex: '1 1 68px',
                  maxWidth: '82px',
                  padding: '12px 6px 10px',
                  background: 'rgba(255, 255, 255, 0.78)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.65)',
                  boxShadow: '0 8px 24px rgba(45, 36, 24, 0.08)',
                  color: '#3d3428',
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <strong data-key="countdown_num" data-style-only="1" style={{ display: 'block', fontSize: '2.4rem', fontWeight: 600, lineHeight: 1, fontFamily: "'Great Vibes', cursive" }}>{value}</strong>
                <span data-key="countdown_lbl" data-style-only="1" style={{ display: 'block', marginTop: 6, fontSize: '0.85rem', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 600, color: '#7a6a57', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{label}</span>
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
  
      <section className="paper-section venue-section" data-bg="venue">  
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
  
      <section className="dress-section" data-bg="dress">  
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
  
      <section className="itinerary" data-bg="itinerary">  
        <h2 className="script-title" data-key="itinerary_title">Itinerario</h2>  
        <div className="itinerary-list">  
         <div className="itinerary-row">  
            <img className="itinerary-img" data-key="itinerary_img_1" src={asset('pdfimg-002.jpg')} alt="" />  
            <span className="itinerary-time" data-key="itinerary_time_1">8:00 PM</span>  
            <span className="itinerary-event" data-key="itinerary_event_1">RECEPCIÓN</span>  
          </div>  
          <div className="itinerary-row">  
            <img className="itinerary-img" data-key="itinerary_img_2" src={asset('pdfimg-003.jpg')} alt="" />  
            <span className="itinerary-time" data-key="itinerary_time_2">9:00 PM</span>  
            <span className="itinerary-event" data-key="itinerary_event_2">CENA</span>  
          </div>  
          <div className="itinerary-row">  
            <img className="itinerary-img" data-key="itinerary_img_3" src={asset('pdfimg-010.jpg')} alt="" />  
            <span className="itinerary-time" data-key="itinerary_time_3">10:00 PM</span>  
            <span className="itinerary-event" data-key="itinerary_event_3">CELEBRACIÓN</span>  
          </div>  
        </div>  
      </section>  
  
      <section className="gift-section" data-bg="gift">  
        <h2 className="dress-title"><span data-key="gift_title_1">SUGERENCIA DE</span><strong data-key="gift_title_2">Regalo</strong></h2>  
        <p className="gift-copy" data-key="gift_copy">  
          COMPARTIR ESTE DÍA CON USTEDES ES EL REGALO MÁS VALIOSO PARA NOSOTROS.  
          NO OBSTANTE, SI DESEAN TENER UN DETALLE ADICIONAL, AGRADECERÍAMOS QUE  
          SEA A TRAVÉS DE  
        </p>  
        <p className="gift-highlight" data-key="gift_highlight">NUESTRA LLUVIA DE SOBRES<br />EL DÍA DEL EVENTO</p>  
        </section>  

    <section className="album-section" data-bg="album">  
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
                const files = Array.from(event.target.files || []);  
                if (!files.length) return;  
                setAlbumQueue(files.map((f) => ({ f, id: `${Date.now()}-${f.name}`, progress: 0, status: 'pendiente' })));  
                event.target.value = '';  
              }}  
          />  
          <button className="olive-button" type="button" onClick={() => albumInput.current?.click()} data-testid="button-photo-upload">  
            <Upload size={14} /> <span data-key="album_button_text">CARGAR</span>  
          </button>  
          {albumQueue.length > 0 && (  
            <>  
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0' }}>  
                {albumQueue.map((q) => (  
                  <li key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>  
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', gap: 10 }}>  
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.f.name}</span>  
                      <span>{q.status === 'listo' ? '✓ listo' : q.status === 'error' ? '✗ error' : q.status === 'subiendo' ? 'subiendo…' : 'pendiente'}</span>  
                    </div>  
                    {q.status === 'subiendo' && (  
                      <div style={{ height: 4, width: '100%', background: '#e4ded2', borderRadius: 2, overflow: 'hidden' }}>  
                        <div style={{ height: '100%', width: '40%', background: '#8a7d5a', borderRadius: 2, animation: 'albumBar 1.2s ease-in-out infinite' }} />  
                      </div>  
                    )}  
                  </li>  
                ))}  
              </ul>  
              <style>{`@keyframes albumBar { from { margin-left: 0 } to { margin-left: 60% } }`}</style>  
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
  
      <section className="faq-section" data-bg="faq">  
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
                  <span data-key={`faq_question_${index + 1}`}>{cfg[`faq_question_${index + 1}`] || faq.question}</span>  
                  {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}  
                </button>  
                {expanded && <p className="faq-answer" data-key={`faq_answer_${index + 1}`}>{cfg[`faq_answer_${index + 1}`] || faq.answer}</p>}  
              </div>  
            );  
          })}  
        </div>  
      </section>  
  
      <section className="rsvp-section" id="rsvp" data-bg="rsvp">  
        <h2 className="script-title" data-key="rsvp_title" style={{ color: '#fffaf4' }}>RSVP</h2>  
        <div className="rsvp-panel">  
          <p className="eyebrow" data-key="rsvp_eyebrow_1">AGRADECEMOS CONFIRMAR SU<br />ASISTENCIA ANTES DEL</p>  
          <p className="rsvp-date" data-key="rsvp_date">23 DE MAYO DE 2026</p>  
          <p className="eyebrow" data-key="rsvp_eyebrow_2">MEDIANTE EL SIGUIENTE FORMULARIO</p>  
          <form className="rsvp-form" onSubmit={previewRsvp}>  
            <div className="rsvp-field">  
              <label htmlFor="guest-name" data-key="rsvp_label_name">NOMBRE DEL INVITADO</label>  
              <input id="guest-name" name="guestName" value={invitee?.name ?? 'María y Pablo'} readOnly data-testid="input-rsvp-name" />  
            </div>  
            <p className="rsvp-note" data-key="rsvp_note">ESTA INVITACIÓN CUENTA CON {invitee?.max_passes || 2} PASES.<br />UNA SOLA PERSONA DEBE CONFIRMAR LA ASISTENCIA.</p>  
            <div className="rsvp-field">  
              <label htmlFor="attendance" data-key="rsvp_label_attendance">CONFIRMACIÓN</label>  
              <select id="attendance" name="attendance" defaultValue="yes" data-testid="select-rsvp-attendance">  
                <option value="yes">CONFIRMO MI ASISTENCIA</option>  
                <option value="no">NO PODRÉ ACOMPAÑARLES</option>  
              </select>  
            </div>  
            <div className="rsvp-field">  
              <label htmlFor="people" data-key="rsvp_label_people">NÚMERO DE PASES</label>  
              <select id="people" name="people" key={invitee?.max_passes || 2} defaultValue={String(invitee?.max_passes || 2)} data-testid="select-rsvp-seats">  
                {Array.from({ length: invitee?.max_passes || 2 }, (_, i) => (  
                  <option key={i + 1} value={i + 1}>{i + 1} PERSONA{i > 0 ? 'S' : ''}</option>  
                ))}  
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
        </div>  
      </section>  
  
      <section className="whatsapp-section" data-bg="whatsapp">  
        <p className="eyebrow" data-key="whatsapp_eyebrow">RSVP POR WHATSAPP</p>  
        <p className="whatsapp-caption" data-key="whatsapp_caption">TAMBIÉN PUEDES CONFIRMAR TU ASISTENCIA A TRAVÉS DEL SIGUIENTE ENLACE DE WHATSAPP</p>  
        <button  
          className="olive-button"  
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
        <p className="whatsapp-note" data-key="whatsapp_note">Enlace de WhatsApp no configurado; la acción solo muestra esta nota.</p>  
      </section>  
  
      <section className="closing">  
        <img src={asset('pdfimg-003.jpg')} data-key="closing_img" alt="" />  
        <div className="closing-footer" data-bg="closing">  
          <div className="closing-content">  
            <p className="script" data-key="closing_names">
              {cfg['closing_names'] || (cfg['couple_heading'] || (getWeddingSlug() === 'angela-robert' ? 'Angela y Robert' : getWeddingSlug().split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' y ')))}
            </p>  
            <p data-key="closing_text">Gracias por acompañarnos en un día que llevaremos siempre en el corazón.</p>  
          </div>  
        </div>  
      </section>
      {confirmOpen && (  
        <div className="rsvp-modal" role="dialog">  
          <div className="rsvp-modal-card">  
            <p className="script-title">¿Está seguro de la información que enviará?</p>  
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>  
              <button className="olive-button" type="button" onClick={doConfirm}>SÍ</button>  
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
              <button className="olive-button" type="button" onClick={() => { setRsvpDone(false); setModifyOpen(false); }}>SÍ</button>    
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
            <button className="olive-button" type="button" onClick={() => setThanks(null)}>CERRAR</button>  
          </div>  
        </div>  
      )}
{cfg.cfg_music_url && (  
        <>  
          <audio ref={audioRef} src={cfg.cfg_music_url} loop preload="auto" />  
          {envelopeOpen && (  
            <button  
              className={`music-fab${musicPlaying ? ' is-playing' : ''}`}  
              type="button"  
              aria-label={musicPlaying ? 'Pausar música' : 'Reproducir música'}  
              onClick={() => {  
                const a = audioRef.current;  
                if (!a) return;  
                if (a.paused) { a.play(); setMusicPlaying(true); }  
                else { a.pause(); setMusicPlaying(false); }  
              }}  
            >  
              {musicPlaying ? <Pause size={22} /> : <Play size={22} />}  
            </button>  
          )}  
        </>  
      )}
      </>)}
      </main>  
  );  
}  
  
export default App;
