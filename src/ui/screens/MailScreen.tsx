import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPack } from '@/core/content';

import { Ico, Panel, assetUrl } from '../components/common';
import { useGame } from '../GameContext';
import { dayMonth } from '../format';
import { loc } from '@/i18n';

/** Mailbox (spec §8 screen 8): mentor letters, newest first; opening one marks it read. */
export function MailScreen({ onClose, onJournal }: { onClose: () => void; onJournal: () => void }) {
  const { t } = useTranslation();
  const mail = useGame((s) => s.labs.mail ?? []);
  const readLetter = useGame((s) => s.readLetter);
  const letters = [...mail].reverse();
  const [openId, setOpenId] = useState<string | null>(letters.find((l) => !l.read)?.id ?? letters[0]?.id ?? null);
  const open = letters.find((l) => l.id === openId);

  useEffect(() => {
    if (open && !open.read) void readLetter(open.id);
  }, [open, readLetter]);

  return (
    <Panel title={t('mail.title')} onClose={onClose} labelledBy="mail-title" className="mail">
      {letters.length === 0 ? (
        <p>{t('mail.empty')}</p>
      ) : (
        <div className="mail__body">
          <ul className="mail__list">
            {letters.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className={`mail__item${l.id === openId ? ' is-open' : ''}`}
                  aria-pressed={l.id === openId}
                  onClick={() => setOpenId(l.id)}
                >
                  <Ico name="mail" />
                  <span className="mail__item-text">
                    <span className="mail__item-title">{l.title}</span>
                    <span className="dv-caption">
                      {loc(getPack(l.pack).mentor.name)} · {dayMonth(l.sentOn)}
                    </span>
                  </span>
                  {!l.read && <span className="dv-chip dv-chip--graded mail__new">{t('mail.unread')}</span>}
                </button>
              </li>
            ))}
          </ul>
          {open && (
            <article className="dv-letter">
              <img className="dv-letter__seal dv-px" src={assetUrl('wax-seal')} alt="" />
              <div className="dv-letter__head">
                <span>{t('mail.from', { name: loc(getPack(open.pack).mentor.name) })}</span>
                <span>{dayMonth(open.sentOn)}</span>
              </div>
              <h3 className="dv-letter__title">{open.title}</h3>
              <p className="dv-letter__body">{open.body}</p>
              <p className="dv-letter__sign">— {open.sign}</p>
              <div className="dialog-actions">
                <button type="button" className="dv-btn" onClick={onClose}>
                  {t('mail.later')}
                </button>
                <button type="button" className="dv-btn dv-btn--primary" onClick={onJournal}>
                  <Ico name="book" />
                  {t('mail.openJournal')}
                </button>
              </div>
            </article>
          )}
        </div>
      )}
    </Panel>
  );
}
