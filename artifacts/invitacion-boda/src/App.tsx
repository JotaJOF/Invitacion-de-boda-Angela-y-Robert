import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MapPin,
  Play,
  Upload,
} from 'lucide-react';

const asset = (filename: string) => `${import.meta.env.BASE_URL}assets/${filename}`;  
  
// ===== FECHA DE LA BODA — cambia SOLO aquí y se actualiza todo =====  
const WEDDING = { year: 2027, month: 3, day: 13, hour: 19 }; // month: 3 = Marzo, hour: 19 = 7 PM  
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];  
const dos = (n: number) => String(n).padStart(2, '0');  
const WEDDING_DATE = new Date(WEDDING.year, WEDDING.month - 1, WEDDING.day, WEDDING.hour);  
const mesNombre = MESES[WEDDING.month - 1];                              // "Marzo"  
const fechaPunteada = `${dos(WEDDING.day)}.${dos(WEDDING.month)}.${WEDDING.year}`; // "13.03.2027"

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
  
function App() {
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [preview, setPreview] = useState('');
  const [albumFile, setAlbumFile] = useState('');
  const albumInput = useRef<HTMLInputElement>(null);  
  
  const targetDate = new Date('2027-03-13T00:00:00-04:00').getTime();  
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));  
  
  useEffect(() => {  
    const timer = window.setInterval(() => {  
      setTimeLeft(getTimeLeft(targetDate));  
    }, 1000);  
    return () => window.clearInterval(timer);  
  }, [targetDate]);

  const openInvitation = () => {
    setEnvelopeOpen(true);
    window.setTimeout(() => {
      document.getElementById('invitation-start')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 360);
  };

  const previewRsvp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const guestName = String(form.get('guestName') || 'María y Pablo').trim();
    const attendance = String(form.get('attendance') || 'yes');
    const people = String(form.get('people') || '2');
    const message = String(form.get('message') || '').trim();
    setPreview(
      attendance === 'yes'
        ? `Vista previa: ${guestName} confirmarían su asistencia para ${people} ${people === '1' ? 'persona' : 'personas'}.${message ? ` Mensaje: “${message}”` : ''}`
        : `Vista previa: ${guestName} indicarían que no podrán acompañarnos.`,
    );
  };

  return (
    <main className="invite-shell" data-testid="page-wedding-invitation">
      <section className="cover" aria-label="Invitación personalizada">
        <div className="cover-names">
          <div className="cover-name" data-testid="text-bride-name">
            <span className="script">A</span>
            <span className="cover-name-text">
              <span className="given-name">NGELA</span>
              <span className="surname">PALMERSTON</span>
            </span>
          </div>
          <div className="cover-name" data-testid="text-groom-name">
            <span className="script">R</span>
            <span className="cover-name-text">
              <span className="given-name">OBERT</span>
              <span className="surname">WILSON</span>
            </span>
          </div>
        </div>
        <span className="cover-and script">and</span>
        <div className="ornament-rule cover-separator" aria-hidden="true">
          <span>✤</span>
        </div>
        <p className="cover-date serif">MONTERREY, NL | {fechaPunteada}</p>

        <button
          className={`envelope-button${envelopeOpen ? ' is-open' : ''}`}
          type="button"
          onClick={openInvitation}
          aria-label="Abrir invitación"
          data-testid="button-open-invitation"
        >
          <img className="envelope-base" src={asset('pdfimg-022.jpg')} alt="" />
          <span className="envelope-open" aria-hidden="true" />
          <img className="envelope-flower top" src={asset('florals-sprig.png')} alt="" />
          <img className="envelope-flower bottom" src={asset('florals-bouquet.png')} alt="" />
        </button>
        <div className="envelope-hint">CLIC EN EL SOBRE PARA ABRIR INVITACIÓN</div>
        <div className="ornament-rule" aria-hidden="true" style={{ marginTop: 8 }}>
          <span>✤</span>
        </div>
        <p className="guest-name script" data-testid="text-invitee-names">María y Pablo</p>
        <p className="guest-reserved">HEMOS RESERVADO</p>
        <p className="guest-count">2</p>
        <p className="guest-caption">LUGARES A TU NOMBRE</p>
      </section>

      <section className="video-still" aria-label="Recuerdo de Angela y Robert">
        <img src={asset('pdfimg-000.png')} alt="Angela y Robert sostienen un ramo de flores" />
        <div className="video-play" aria-hidden="true"><span><Play size={31} fill="currentColor" strokeWidth={0} /></span></div>
      </section>

      <section className="olive-section blessing" id="invitation-start">
        <p className="eyebrow">CON LA BENDICIÓN DE DIOS Y EL CARIÑO DE<br />NUESTROS PADRES</p>
        <div className="parents-block">
          <h3>PADRES DE LA NOVIA</h3>
          <p>MARIBEL TORRES BALDERAS</p>
          <p>JOSÉ ELÍAS ALVARADO CORPUS</p>
        </div>
        <div className="parents-block">
          <h3>PADRES DEL NOVIO</h3>
          <p>JULIETA GUZMAN VICHELIN</p>
          <p>SAMUEL JOEL CERVANTES</p>
        </div>
      </section>

      <section className="paper-section">
        <h1 className="couple-heading script" data-testid="text-couple-names">
          Angela Palmerston <small>y</small> Robert Wilson
        </h1>
        <p className="section-copy">
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
            alt="Sobre de Angela y Robert"  
            style={{ width: '100%', height: 'auto', display: 'block' }}  
          />  
  
          {/* Texto dentro de la tarjeta blanca (lado derecho), debajo del sello */}  
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
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 12, letterSpacing: '.09em' }}>Reserva</span>  
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 12, letterSpacing: '.09em' }}>ESTA FECHA</span>  
            <span className="serif" style={{ fontSize: 38, lineHeight: 0.9 }}>{WEDDING.day}</span>  
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15 }}>{mesNombre}</span>  
            <span style={{ fontSize: 12, letterSpacing: '.1em' }}>{WEDDING.year}</span>  
          </div>  
  
          {/* Botón sobre el lado izquierdo (debajo del sobre), a la altura de la tarjeta */}  
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
          alt=""  
          aria-hidden="true"  
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}  
        />  
        <div style={{ position: 'relative', zIndex: 1 }}>  
          <h2 className="countdown-heading" style={{ color: '#4a3f2f' }}>SOLO FALTAN</h2>  
          <p className="countdown-label" style={{ color: '#6b5d4a' }}>  
            {WEDDING.day} · {mesNombre.toUpperCase()} · {WEDDING.year}  
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
  
      <section className="closing-photo-section" style={{ width: '100%' }}>  
        <img  
          src={asset('couple-veil.webp')}  
          alt="Angela y Robert"  
          style={{ width: '100%', height: 'auto', display: 'block' }}  
        />  
      </section>

      <section className="paper-section venue-section">
        <h2 className="script-title">Ceremonia <span className="serif">&</span> Recepción</h2>
        <img className="venue-image" src={asset('pdfimg-011.jpg')} alt="Jardines y arquitectura de la Quinta El Edén" />
        <h3 className="venue-name">QUINTA EL EDÉN</h3>
        <p className="venue-time">7:00 PM</p>
        <p className="venue-address">
          P.º de las Gardenias 602, Nueva Castilla,<br />
          66052 Cd. Gral. Escobedo, N.L.
        </p>
        <a className="olive-button" href={mapUrl} target="_blank" rel="noreferrer" data-testid="link-venue-map">
          <MapPin size={14} /> VER UBICACIÓN
        </a>
      </section>

      <section className="dress-section">
        <h2 className="dress-title">CÓDIGO DE<strong>Vestimenta</strong></h2>
        <p className="dress-copy">
          FORMAL<br />
          TAMBIÉN PUEDES OPTAR POR ESTILO VAQUERO ELEGANTE.<br />
          EL COLOR BLANCO Y BEIGE ESTÁN RESERVADOS PARA LA NOVIA.<br />
          PARA CABALLEROS, EL TRAJE BEIGE ESTÁ RESERVADO PARA EL NOVIO.
        </p>
        <p className="inspiration-label">INSPIRACIÓN MUJERES</p>
        <div className="inspiration-grid">
          <div>
            <img src={asset('pdfimg-010.jpg')} alt="Inspiración de vestimenta formal" />
            <span>FORMAL · ELEGANTE</span>
          </div>
          <div>
            <img src={asset('pdfimg-002.jpg')} alt="Inspiración de vestimenta para la celebración" />
            <span>TONOS DE TEMPORADA</span>
          </div>
        </div>
        <p className="inspiration-label">INSPIRACIÓN HOMBRES</p>
        <div className="inspiration-grid">
          <div>
            <img src={asset('pdfimg-003.jpg')} alt="Traje formal para caballero" />
            <span>TRAJE FORMAL</span>
          </div>
          <div>
            <img src={asset('pdfimg-010.jpg')} alt="Inspiración de vestimenta formal para caballero" />
            <span>ESTILO VAQUERO ELEGANTE</span>
          </div>
        </div>
      </section>

      <section className="itinerary">
        <h2 className="script-title">Itinerario</h2>
        <div className="itinerary-list">
          <div className="itinerary-row">
            <span className="itinerary-time">8:00 PM</span>
            <span className="itinerary-event">RECEPCIÓN</span>
          </div>
          <div className="itinerary-row">
            <span className="itinerary-time">9:00 PM</span>
            <span className="itinerary-event">CENA</span>
          </div>
          <div className="itinerary-row">
            <span className="itinerary-time">10:00 PM</span>
            <span className="itinerary-event">CELEBRACIÓN</span>
          </div>
        </div>
      </section>

      <section className="gift-section">
        <h2 className="dress-title">SUGERENCIA DE<strong>Regalo</strong></h2>
        <p className="gift-copy">
          COMPARTIR ESTE DÍA CON USTEDES ES EL REGALO MÁS VALIOSO PARA NOSOTROS.
          NO OBSTANTE, SI DESEAN TENER UN DETALLE ADICIONAL, AGRADECERÍAMOS QUE
          SEA A TRAVÉS DE
        </p>
        <p className="gift-highlight">NUESTRA LLUVIA DE SOBRES<br />EL DÍA DEL EVENTO</p>
        <div className="photo-album">
          <p>COMPARTE TUS FOTOS Y LOS MOMENTOS MÁS ESPECIALES USANDO NUESTRO ÁLBUM DE FOTOS</p>
          <input
            ref={albumInput}
            type="file"
            accept="image/*"
            hidden
            aria-label="Elegir una foto para el álbum"
            data-testid="input-photo-upload"
            onChange={(event) => setAlbumFile(event.target.files?.[0]?.name ?? '')}
          />
          <button className="olive-button light" type="button" onClick={() => albumInput.current?.click()} data-testid="button-photo-upload">
            <Upload size={14} /> SUBIR
          </button>
          {albumFile && (
            <p className="preview-caption" data-testid="status-photo-preview">
              {albumFile} · Vista previa local; la foto aún no se comparte en un álbum.
            </p>
          )}
        </div>
      </section>

      <section className="faq-section">
        <h2 className="script-title">Recomendaciones <span className="serif">& FAQ</span></h2>
        <p className="faq-intro">
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
                  <span>{faq.question}</span>
                  {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </button>
                {expanded && <p className="faq-answer">{faq.answer}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rsvp-section" id="rsvp">
        <h2 className="script-title" style={{ color: '#fffaf4' }}>RSVP</h2>
        <div className="rsvp-panel">
          <p className="eyebrow">AGRADECEMOS CONFIRMAR SU<br />ASISTENCIA ANTES DEL</p>
          <p className="rsvp-date">23 DE MAYO DE 2026</p>
          <p className="eyebrow">MEDIANTE EL SIGUIENTE FORMULARIO</p>
          <form className="rsvp-form" onSubmit={previewRsvp}>
            <div className="rsvp-field">
              <label htmlFor="guest-name">NOMBRE DEL INVITADO</label>
              <input id="guest-name" name="guestName" defaultValue="María y Pablo" data-testid="input-rsvp-name" />
            </div>
            <p className="rsvp-note">ESTA INVITACIÓN CUENTA CON 2 PASES.<br />UNA SOLA PERSONA DEBE CONFIRMAR LA ASISTENCIA.</p>
            <div className="rsvp-field">
              <label htmlFor="attendance">CONFIRMACIÓN</label>
              <select id="attendance" name="attendance" defaultValue="yes" data-testid="select-rsvp-attendance">
                <option value="yes">CONFIRMO MI ASISTENCIA</option>
                <option value="no">NO PODRÉ ACOMPAÑARLES</option>
              </select>
            </div>
            <div className="rsvp-field">
              <label htmlFor="people">NÚMERO DE PASES</label>
              <select id="people" name="people" defaultValue="2" data-testid="select-rsvp-seats">
                <option value="1">1 PERSONA</option>
                <option value="2">2 PERSONAS</option>
              </select>
            </div>
            <div className="rsvp-field">
              <label htmlFor="message">MENSAJE PARA LOS NOVIOS</label>
              <textarea id="message" name="message" data-testid="input-rsvp-message" />
            </div>
            <button className="olive-button light" type="submit" data-testid="button-rsvp-preview">
              VER CONFIRMACIÓN
            </button>
            {preview && <p className="preview-message" role="status" data-testid="status-rsvp-preview">{preview}</p>}
            <p className="preview-caption">Vista previa únicamente. Esta invitación no envía ni guarda confirmaciones.</p>
          </form>
          <div style={{ marginTop: 22 }}>
            <p className="eyebrow">RSVP POR WHATSAPP</p>
            <p className="preview-caption">TAMBIÉN PUEDES CONFIRMAR TU ASISTENCIA A TRAVÉS DEL SIGUIENTE ENLACE DE WHATSAPP</p>
            <a
              className="olive-button light"
              href="#rsvp"
              onClick={(event) => {
                event.preventDefault();
                setPreview('No hay un enlace de WhatsApp configurado. Esta es solo una vista previa; no se enviará ninguna confirmación.');
              }}
              data-testid="link-whatsapp-preview"
              style={{ marginTop: 13 }}
            >
              CONFIRMAR ASISTENCIA
            </a>
            <p className="preview-caption">Enlace de WhatsApp no configurado; la acción solo muestra esta nota.</p>
          </div>
        </div>
      </section>

      <section className="closing">
        <img src={asset('pdfimg-003.jpg')} alt="" />
        <div className="closing-content">
          <p>AGRADECEMOS PROFUNDAMENTE SU PRESENCIA Y SUS MUESTRAS DE CARIÑO EN NUESTRO DÍA ESPECIAL.</p>
          <p className="script">Angela y Robert</p>
        </div>
      </section>
      <footer className="footer-note">CON CARIÑO, ANGELA &amp; ROBERT · {fechaPunteada}</footer>
    </main>
  );
}

export default App;
