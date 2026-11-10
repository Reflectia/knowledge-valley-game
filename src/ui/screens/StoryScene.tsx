import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fill } from '@/core/mentors';
import type { StoryScene as Scene } from '@/core/story';

import { Overlay, assetUrl } from '../components/common';

/**
 * An act 1 story scene (spec §2): a story letter (MentorLetter README: «сюжетні листи») read line
 * by line, with the emblem of the valley as its seal.
 */
export function StoryScene({ scene, name, onDone }: { scene: Scene; name: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const last = i >= scene.lines.length - 1;

  return (
    <Overlay dim>
      <article className="dv-letter story" role="dialog" aria-modal="true" aria-labelledby="story-title">
        <img className="story__picture dv-px" src={assetUrl(scene.image)} alt="" />
        <h2 className="dv-letter__title" id="story-title">
          {scene.title}
        </h2>
        <p className="dv-letter__body story__line" aria-live="polite">
          {fill(scene.lines[i], { name })}
        </p>
        {last && scene.sign && <p className="dv-letter__sign">— {scene.sign}</p>}
        <div className="dialog-actions">
          <span className="dv-caption story__count">
            {i + 1} / {scene.lines.length}
          </span>
          <button
            key={last ? 'done' : 'next'}
            type="button"
            className="dv-btn dv-btn--primary"
            autoFocus
            onClick={() => (last ? onDone() : setI(i + 1))}
          >
            {last ? t('story.done') : t('dialog.next')}
          </button>
        </div>
      </article>
    </Overlay>
  );
}
