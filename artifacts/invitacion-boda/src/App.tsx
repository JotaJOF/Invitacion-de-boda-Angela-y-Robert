import { useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MapPin,
  Play,
  Upload,
} from 'lucide-react';

const asset = (filename: string) => `${import.meta.env.BASE_URL}assets/${filename}`;

const mapUrl =
  'https://www.google.com/maps/search/?api=1&query=Quinta+El+Ed%C3%A9n%2C+Paseo+de+las+Gardenias+602%2C+Nueva+Castilla%2C+Escobedo%2C+Nuevo+Le%C3%B3n';

function downloadCalendar() {
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Angela y Robert//Invitacion de boda//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:angela-robert-20260613@invitacion.local',
    'DTSTAMP:20260523T120000Z',
    'DTSTART;TZID=America/Monterrey:20260613T190000',
    'DTEND;TZID=America/Monterrey:20260613T230000',
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
  link.download = 'angela-y-robert-13-junio-2026.ics';
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

function App() {
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [preview, setPreview] = useState('');
  const [albumFile, setAlbumFile] = useState('');
  const albumInput = useRef<HTMLInputElement>(null);

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
        <p className="cover-date serif">MONTERREY, NL | 13.06.2026</p>

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
        <div className="save-date" data-testid="status-save-the-date">
          <span className="save-date-label">Reserva</span>
          <span className="save-date-label">ESTA FECHA</span>
          <span className="save-date-day serif">13</span>
          <span className="save-date-month">Junio</span>
          <span className="save-date-year">2026</span>
        </div>
        <button
          className="outline-button"
          type="button"
          onClick={downloadCalendar}
          data-testid="button-add-calendar"
        >
          <CalendarDays size={15} /> AGENDAR EN CALENDARIO
        </button>
      </section>

      <section className="countdown" aria-label="Cuenta regresiva">
        <h2 className="countdown-heading">SOLO FALTAN</h2>
        <p className="countdown-label">13 · JUNIO · 2026</p>
        <div className="countdown-grid" data-testid="status-countdown-completed">
          {[
            ['00', 'DÍAS'],
            ['00', 'HORAS'],
            ['00', 'MINUTOS'],
            ['00', 'SEGUNDOS'],
          ].map(([value, label]) => (
            <div className="count-cell" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="countdown-label" style={{ margin: '17px 0 0' }}>
          LA CUENTA REGRESIVA HA TERMINADO
        </p>
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
      <footer className="footer-note">CON CARIÑO, ANGELA &amp; ROBERT · 13.06.2026</footer>
    </main>
  );
}

export default App;
