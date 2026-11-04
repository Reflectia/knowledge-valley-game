import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { packByBranch } from '@/core/content';
import { BRANCHES, activeSkills, freePoints, skillState } from '@/core/skills';

import { Ico, Panel } from '../components/common';
import { showToast } from '../components/Toasts';
import { useGame } from '../GameContext';

const STATE_ICON = { learned: 'check', available: 'spark', locked: 'lock' } as const;

/**
 * Skill tree (spec §5, screen 6; SkillNode README): five branches, points only from
 * labs. An available skill can be learned with the branch's free points.
 */
export function SkillTreeScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const learned = useGame((s) => s.labs.skills ?? []);
  const points = useGame((s) => s.progress.skillPoints);
  const learnSkill = useGame((s) => s.learnSkill);
  const active = new Set(activeSkills(learned, points));

  return (
    <Panel title={t('skills.title')} onClose={onClose} labelledBy="skills-title" className="skills">
      <p className="dv-caption">{t('skills.needLabs')}</p>
      <div className="skills__branches">
        {Object.entries(BRANCHES).map(([branch, chain]) => {
          const pack = packByBranch(branch);
          const total = points[branch] ?? 0;
          return (
            <section key={branch} className="skills__branch">
              <header className="skills__head">
                <span className="skills__branch-name">{pack?.branch.name.uk ?? branch}</span>
                <span className="dv-caption">{t('skills.branchPoints', { free: freePoints(branch, learned, points), total })}</span>
              </header>
              <div className="skills__chain">
                {chain.map((skill, i) => {
                  const state = skillState(skill.id, learned, points);
                  return (
                    <Fragment key={skill.id}>
                      {i > 0 && <span className={`dv-tree__link${active.has(skill.id) ? ' is-learned' : ''}`} aria-hidden />}
                      <button
                        type="button"
                        className={`dv-skill is-${state} skills__node`}
                        // aria-disabled (not disabled) so the tooltip still shows on hover.
                        aria-disabled={state !== 'available'}
                        data-tip={skill.name}
                        data-tip-text={skill.later ? `${skill.text} ${t(`skills.later.${skill.later}`)}` : skill.text}
                        onClick={async () => {
                          if (state === 'available' && (await learnSkill(skill.id))) showToast({ icon: 'spark', title: t('skills.learnedToast', { name: skill.name }) });
                        }}
                      >
                        <span className="dv-skill__node">
                          <Ico name={STATE_ICON[state]} />
                        </span>
                        <span className="dv-skill__name">{skill.name}</span>
                        <span className="dv-skill__state">
                          {t(`skills.${state}`)}
                          {state !== 'learned' ? ` · ${t('skills.cost', { count: skill.cost })}` : ''}
                        </span>
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
