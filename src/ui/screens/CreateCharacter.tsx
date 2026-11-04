import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_APPEARANCE, type Appearance, type Role } from '@/game/assets/recolor';

import { HeroinePreview } from '../components/HeroinePreview';
import { Ico, Overlay, Panel, useEscape } from '../components/common';

const OPTIONS: Record<Role, string[]> = {
  hair: ['red', 'brown', 'blond', 'violet'],
  skin: ['light', 'tan', 'brown', 'dark'],
  shirt: ['green', 'blue', 'orange', 'violet'],
};

const MAX_NAME = 16;

/** Character creation (spec §5, screen 2): name, hair, skin and clothes colors. */
export function CreateCharacter({ onBack, onCreate }: { onBack: () => void; onCreate: (name: string, a: Appearance) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<Appearance>({ ...DEFAULT_APPEARANCE });
  const [tried, setTried] = useState(false);
  useEscape(onBack);

  const trimmed = name.trim();
  const submit = () => {
    setTried(true);
    if (trimmed) onCreate(trimmed, appearance);
  };

  return (
    <Overlay>
      <Panel title={t('create.title')} onClose={onBack} labelledBy="create-title" className="create">
        <div className="create__body">
          <div className="create__preview dv-page">
            <HeroinePreview appearance={appearance} />
          </div>
          <form
            className="create__form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className={`dv-field${tried && !trimmed ? ' is-error' : ''}`}>
              <span className="dv-field__label">{t('create.name')}</span>
              <input
                className="dv-input"
                value={name}
                maxLength={MAX_NAME}
                placeholder={t('create.namePlaceholder')}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              {tried && !trimmed ? (
                <span className="dv-field__error">
                  <Ico name="warn" />
                  {t('create.nameRequired')}
                </span>
              ) : (
                <span className="dv-field__help">{t('create.nameHelp')}</span>
              )}
            </label>
            {(Object.keys(OPTIONS) as Role[]).map((role) => (
              <fieldset key={role} className="create__choice">
                <legend className="dv-field__label">{t(`create.${role}`)}</legend>
                <div className="dv-lang__group">
                  {OPTIONS[role].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="dv-btn"
                      aria-pressed={appearance[role] === opt}
                      onClick={() => setAppearance((a) => ({ ...a, [role]: opt }))}
                    >
                      {t(`create.options.${role}.${opt}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="dialog-actions">
              <button type="button" className="dv-btn" onClick={onBack}>
                {t('common.back')}
              </button>
              <button type="submit" className="dv-btn dv-btn--primary">
                {t('create.begin')}
              </button>
            </div>
          </form>
        </div>
      </Panel>
    </Overlay>
  );
}
