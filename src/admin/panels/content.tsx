import { Plus } from 'lucide-react';
import { blankContact, blankSocial } from '../../content/factory';
import type { EmblemStyle, PhotoFocus } from '../../content/types';
import { siteUrl, whatsappShareHref } from '../../lib/links';
import { WhatsAppIcon } from '../../site/WhatsAppIcon';
import type { Editor } from '../useEditor';
import {
  Button,
  Card,
  Grid,
  ImageField,
  Notice,
  NumberField,
  PageHeader,
  RowControls,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
  moveItem,
} from '../ui';

interface PanelProps {
  editor: Editor;
}

const EMBLEMS: Array<{ value: EmblemStyle; label: string }> = [
  { value: 'ganesha', label: 'Ganesh Ji, line drawing in gold' },
  { value: 'medallion', label: 'Ganesh Ji medallion, as on the printed card' },
  { value: 'om', label: 'Om symbol' },
  { value: 'none', label: 'No symbol' },
];

const FOCUS: Array<{ value: PhotoFocus; label: string }> = [
  { value: 'center', label: 'Centre' },
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

/* ------------------------- names and opening ------------------------- */

export function CouplePanel({ editor }: PanelProps) {
  const { content, update } = editor;
  const { couple, opening } = content;
  return (
    <>
      <PageHeader title="Names and Opening Invitation" description="The names shown across the website, and everything on the first screen that guests see before they open the invitation." />
      <div className="space-y-6">
        <Card title="The couple">
          <Grid>
            <TextField label="Bride's name" value={couple.brideName} onChange={(v) => update((d) => void (d.couple.brideName = v))} />
            <TextField label="Groom's name" value={couple.groomName} onChange={(v) => update((d) => void (d.couple.groomName = v))} />
          </Grid>
          <Grid>
            <TextField
              label="Bride's parents (optional)"
              value={couple.brideParents}
              placeholder="For example: Daughter of Mr and Mrs Singh"
              hint="Shown under the names on the welcome section. Leave empty to hide."
              onChange={(v) => update((d) => void (d.couple.brideParents = v))}
            />
            <TextField
              label="Groom's parents (optional)"
              value={couple.groomParents}
              placeholder="For example: Son of Mr and Mrs Kaushik"
              onChange={(v) => update((d) => void (d.couple.groomParents = v))}
            />
          </Grid>
        </Card>

        <Card title="Monogram" description="The monogram appears on the seal of the opening screen and in the footer.">
          <ImageField
            label="Monogram artwork"
            value={couple.monogramImage}
            onChange={(v) => update((d) => void (d.couple.monogramImage = v))}
            optional
            defaultValue="media/art/monogram.svg"
            shape="square"
            hint="A picture with a transparent background works best. If you remove the artwork, the initials below are shown instead."
          />
          <TextField label="Initials" value={couple.monogram} maxLength={6} onChange={(v) => update((d) => void (d.couple.monogram = v))} />
        </Card>

        <Card title="Opening invitation" description="The first screen. Guests tap the button to open the invitation, and that tap is also what allows the music to begin.">
          <SelectField label="Symbol at the top" value={opening.emblem} options={EMBLEMS} onChange={(v) => update((d) => void (d.opening.emblem = v))} />
          <TextField label="Invocation" value={opening.invocation} lang="hi" onChange={(v) => update((d) => void (d.opening.invocation = v))} hint="Leave empty to hide." />
          <TextField label="Invitation heading" value={opening.heading} onChange={(v) => update((d) => void (d.opening.heading = v))} />
          <TextAreaField label="Invitation message" value={opening.message} rows={2} onChange={(v) => update((d) => void (d.opening.message = v))} hint="Shown under the names. Short messages fit small phones best." />
          <Grid>
            <TextField label="Date line" value={opening.dateLine} onChange={(v) => update((d) => void (d.opening.dateLine = v))} />
            <TextField label="Button text" value={opening.buttonLabel} onChange={(v) => update((d) => void (d.opening.buttonLabel = v))} />
          </Grid>
          <ImageField
            label="Background picture (optional)"
            value={opening.backgroundImage}
            onChange={(v) => update((d) => void (d.opening.backgroundImage = v))}
            optional
            hint="Blended softly behind the wine-coloured cover. Leave empty to keep the cover as designed."
          />
        </Card>
      </div>
    </>
  );
}

/* --------------------------- welcome section --------------------------- */

export function WelcomePanel({ editor }: PanelProps) {
  const { content, update } = editor;
  const { welcome, countdown } = content;
  return (
    <>
      <PageHeader title="Welcome and Countdown" description="The section guests see as soon as the invitation opens: your photograph, the welcome note and the countdown." />
      <div className="space-y-6">
        <Card title="Photograph">
          <ImageField
            label="Couple photograph"
            value={welcome.photo}
            onChange={(v) => update((d) => void ((d.welcome.photo = v), (d.welcome.photoFocus = 'center')))}
            defaultValue="media/photos/together.jpg"
            shape="tall"
            hint="Shown inside the arch frame. A portrait photograph with both faces near the middle works best."
          />
          <SelectField
            label="Part of the photograph to keep in view"
            value={welcome.photoFocus}
            options={FOCUS}
            onChange={(v) => update((d) => void (d.welcome.photoFocus = v))}
            hint="The arch frame is taller than it is wide, so wide photographs are cropped. Choose the side where your faces are."
          />
        </Card>

        <Card title="Welcome text">
          <TextField label="Small heading" value={welcome.eyebrow} onChange={(v) => update((d) => void (d.welcome.eyebrow = v))} />
          <TextAreaField label="Welcome message" value={welcome.message} rows={4} onChange={(v) => update((d) => void (d.welcome.message = v))} />
          <Grid>
            <TextField label="Wedding date, as text" value={welcome.dateLabel} onChange={(v) => update((d) => void (d.welcome.dateLabel = v))} />
            <TextField label="Place" value={welcome.locationLabel} onChange={(v) => update((d) => void (d.welcome.locationLabel = v))} />
          </Grid>
          <Grid>
            <TextField label="Text of the events button" value={welcome.eventsButtonLabel} onChange={(v) => update((d) => void (d.welcome.eventsButtonLabel = v))} />
            <TextField label="Text of the gallery button" value={welcome.galleryButtonLabel} onChange={(v) => update((d) => void (d.welcome.galleryButtonLabel = v))} />
          </Grid>
          <ImageField label="Background picture (optional)" value={welcome.backgroundImage} onChange={(v) => update((d) => void (d.welcome.backgroundImage = v))} optional />
        </Card>

        <Card title="Countdown">
          <Toggle label="Show the countdown" checked={countdown.enabled} onChange={(v) => update((d) => void (d.countdown.enabled = v))} />
          <TextField
            label="Count down to (India time)"
            type="datetime-local"
            value={countdown.target}
            onChange={(v) => update((d) => void (d.countdown.target = v))}
            hint="The date and time are always treated as India Standard Time, wherever the guest is."
          />
          <TextField label="Text above the countdown" value={countdown.label} onChange={(v) => update((d) => void (d.countdown.label = v))} />
          <TextAreaField label="Message once the moment has arrived" value={countdown.doneMessage} rows={2} onChange={(v) => update((d) => void (d.countdown.doneMessage = v))} />
        </Card>
      </div>
    </>
  );
}

/* ----------------------------- RSVP settings ----------------------------- */

export function RsvpSettingsPanel({ editor }: PanelProps) {
  const { content, update } = editor;
  const { rsvp } = content;
  const offered = content.events.filter((event) => event.visible && event.rsvp).map((event) => event.name);
  return (
    <>
      <PageHeader title="RSVP Form" description="The wording and rules of the RSVP form. Responses themselves are under RSVP Responses." />
      <div className="space-y-6">
        <Card title="Accepting responses">
          <Toggle
            label="Accept RSVPs"
            hint="When switched off and published, the form is replaced by the closed message and the database refuses new responses."
            checked={rsvp.enabled}
            onChange={(v) => update((d) => void (d.rsvp.enabled = v))}
          />
          <NumberField
            label="Largest party size"
            value={rsvp.maxGuests}
            min={1}
            max={50}
            onChange={(v) => update((d) => void (d.rsvp.maxGuests = Math.min(50, Math.max(1, Math.round(v)))))}
            hint="The highest number a guest can enter for the number of guests."
          />
          <Toggle
            label="Let guests say they cannot attend"
            hint="Adds a tick box, so that guests who cannot come can still send their wishes."
            checked={rsvp.allowDecline}
            onChange={(v) => update((d) => void (d.rsvp.allowDecline = v))}
          />
          <Notice>
            {offered.length > 0
              ? `Guests can currently choose from: ${offered.join(', ')}. To change this list, open Events and use "Offer in the RSVP form" on each event.`
              : 'No event is offered in the form at the moment. Open Events and switch on "Offer in the RSVP form" for the events guests should choose from.'}
          </Notice>
        </Card>

        <Card title="Wording">
          <Grid>
            <TextField label="Small heading" value={rsvp.eyebrow} onChange={(v) => update((d) => void (d.rsvp.eyebrow = v))} />
            <TextField label="Button text" value={rsvp.submitLabel} onChange={(v) => update((d) => void (d.rsvp.submitLabel = v))} />
          </Grid>
          <TextField label="Heading" value={rsvp.heading} onChange={(v) => update((d) => void (d.rsvp.heading = v))} />
          <TextAreaField label="Description" value={rsvp.description} rows={2} onChange={(v) => update((d) => void (d.rsvp.description = v))} />
          <TextField
            label="Reply-by note (optional)"
            value={rsvp.deadlineNote}
            placeholder="For example: Kindly reply by 25 November 2026"
            onChange={(v) => update((d) => void (d.rsvp.deadlineNote = v))}
          />
        </Card>

        <Card title="After a guest responds">
          <TextField label="Thank-you heading" value={rsvp.successTitle} onChange={(v) => update((d) => void (d.rsvp.successTitle = v))} />
          <TextAreaField label="Thank-you message" value={rsvp.successMessage} rows={2} onChange={(v) => update((d) => void (d.rsvp.successMessage = v))} />
          <TextAreaField label="Message when RSVPs are closed" value={rsvp.closedMessage} rows={2} onChange={(v) => update((d) => void (d.rsvp.closedMessage = v))} />
          <ImageField label="Background picture (optional)" value={rsvp.backgroundImage} onChange={(v) => update((d) => void (d.rsvp.backgroundImage = v))} optional />
        </Card>
      </div>
    </>
  );
}

/* -------------------------------- footer -------------------------------- */

export function FooterPanel({ editor }: PanelProps) {
  const { content, update } = editor;
  const { footer } = content;
  return (
    <>
      <PageHeader title="Footer and Contact" description="The closing section: your thank-you note, the phone numbers for RSVP and the share button." />
      <div className="space-y-6">
        <Card title="Thank-you note">
          <Toggle label="Show the footer" checked={footer.visible} onChange={(v) => update((d) => void (d.footer.visible = v))} />
          <TextField label="Heading" value={footer.thankYouHeading} onChange={(v) => update((d) => void (d.footer.thankYouHeading = v))} />
          <TextAreaField label="Message" value={footer.message} rows={3} onChange={(v) => update((d) => void (d.footer.message = v))} />
          <TextField label="Closing line" value={footer.closingLine} onChange={(v) => update((d) => void (d.footer.closingLine = v))} hint="Your first names are added underneath automatically." />
          <ImageField label="Background picture (optional)" value={footer.backgroundImage} onChange={(v) => update((d) => void (d.footer.backgroundImage = v))} optional />
        </Card>

        <Card
          title="Contact numbers"
          description="Guests can tap a number to call, or tap the WhatsApp button next to it."
          actions={
            <Button small icon={<Plus size={15} aria-hidden="true" />} onClick={() => update((d) => void d.footer.contacts.push(blankContact()))}>
              Add number
            </Button>
          }
        >
          <TextField label="Heading above the numbers" value={footer.contactsHeading} onChange={(v) => update((d) => void (d.footer.contactsHeading = v))} />
          {footer.contacts.length === 0 ? <p className="font-sans text-sm text-stone-500">No contact numbers yet.</p> : null}
          {footer.contacts.map((contact, index) => (
            <div key={contact.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="min-w-[9rem] flex-1">
                <TextField
                  label="Name (optional)"
                  value={contact.label}
                  placeholder="For example: Nitin"
                  onChange={(v) => update((d) => void (d.footer.contacts[index].label = v))}
                />
              </div>
              <div className="min-w-[9rem] flex-1">
                <TextField label="Phone number" type="tel" value={contact.phone} onChange={(v) => update((d) => void (d.footer.contacts[index].phone = v))} />
              </div>
              <RowControls
                index={index}
                count={footer.contacts.length}
                itemName="number"
                onMove={(from, to) => update((d) => void (d.footer.contacts = moveItem(d.footer.contacts, from, to)))}
                onRemove={() => update((d) => void d.footer.contacts.splice(index, 1))}
              />
            </div>
          ))}
        </Card>

        <Card
          title="Social links (optional)"
          description="For example an Instagram page or a wedding hashtag link."
          actions={
            <Button small icon={<Plus size={15} aria-hidden="true" />} onClick={() => update((d) => void d.footer.socials.push(blankSocial()))}>
              Add link
            </Button>
          }
        >
          {footer.socials.length === 0 ? <p className="font-sans text-sm text-stone-500">No social links. This part of the footer stays hidden.</p> : null}
          {footer.socials.map((social, index) => (
            <div key={social.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="min-w-[9rem] flex-1">
                <TextField label="Text" value={social.label} placeholder="Instagram" onChange={(v) => update((d) => void (d.footer.socials[index].label = v))} />
              </div>
              <div className="min-w-[12rem] flex-[2]">
                <TextField label="Link" type="url" value={social.url} placeholder="https://" onChange={(v) => update((d) => void (d.footer.socials[index].url = v))} />
              </div>
              <RowControls
                index={index}
                count={footer.socials.length}
                itemName="link"
                onMove={(from, to) => update((d) => void (d.footer.socials = moveItem(d.footer.socials, from, to)))}
                onRemove={() => update((d) => void d.footer.socials.splice(index, 1))}
              />
            </div>
          ))}
        </Card>

        <Card title="Sharing">
          <Toggle label="Show the “Share on WhatsApp” button" checked={footer.showShareButton} onChange={(v) => update((d) => void (d.footer.showShareButton = v))} />
        </Card>
      </div>
    </>
  );
}

/* -------------------------------- sharing -------------------------------- */

export function SharingPanel({ editor }: PanelProps) {
  const { content, update } = editor;
  const { share } = content;
  const link = siteUrl();
  return (
    <>
      <PageHeader title="Sharing and Link Preview" description="How the invitation looks when the link is sent on WhatsApp, and the message that goes with it." />
      <div className="space-y-6">
        <Card title="Your invitation link">
          <p className="break-all rounded-lg bg-stone-100 px-3 py-2.5 font-mono text-[0.85rem] text-stone-800" data-testid="site-link">
            {link}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsappShareHref(share.whatsappMessage, link)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-wine-800 px-4 font-sans text-sm font-semibold text-white hover:bg-wine-700"
            >
              <WhatsAppIcon size={16} />
              Send on WhatsApp
            </a>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-stone-300 bg-white px-4 font-sans text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              Open the website
            </a>
          </div>
        </Card>

        <Card title="WhatsApp message" description="Used by the share buttons on the website. Write {link} where the website address should appear.">
          <TextAreaField label="Message" value={share.whatsappMessage} rows={14} onChange={(v) => update((d) => void (d.share.whatsappMessage = v))} />
        </Card>

        <Card title="Link preview" description="The title, description and thumbnail that WhatsApp shows under the link.">
          <TextField label="Title" value={share.title} onChange={(v) => update((d) => void (d.share.title = v))} />
          <TextAreaField label="Description" value={share.description} rows={2} onChange={(v) => update((d) => void (d.share.description = v))} />
          <ImageField
            label="Thumbnail (optional)"
            value={share.image}
            onChange={(v) => update((d) => void (d.share.image = v))}
            optional
            hint="Leave empty to use the invitation thumbnail that comes with the website. A wide picture of about 1200 by 630 pixels works best."
          />
          <Notice tone="warning">
            The link preview is the one part of the website that does not change instantly. WhatsApp reads it from the page itself, so after you publish a new title,
            description or thumbnail, the website needs to be redeployed once (one click in your hosting dashboard; see the README). WhatsApp also remembers the
            preview of a link it has already shown, so it is best to settle this before sending the invitation out.
          </Notice>
        </Card>
      </div>
    </>
  );
}
