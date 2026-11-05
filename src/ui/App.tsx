import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { needsExportReminder } from '@/core/rules';
import type { RewardEvent, UiScale } from '@/core/types';

import { Overlay } from './components/common';
import { HoverTip } from './components/HoverTip';
import { Toasts, showToast } from './components/Toasts';
import { itemCursor } from './itemCursor';
import { useGame, useGameApi } from './GameContext';
import { CreateCharacter } from './screens/CreateCharacter';
import { GameMenu } from './screens/GameMenu';
import { Hud } from './screens/Hud';
import { ImportScreen } from './screens/ImportScreen';
import { DialogBox } from './screens/DialogBox';
import { InventoryScreen } from './screens/InventoryScreen';
import { MailScreen } from './screens/MailScreen';
import { Journal } from './screens/Journal';
import { RewardScene } from './screens/RewardScene';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShopScreen } from './screens/ShopScreen';
import { SkillTreeScreen } from './screens/SkillTreeScreen';
import { SleepDialog } from './screens/SleepDialog';
import { StartMenu } from './screens/StartMenu';

type Screen = 'start' | 'create' | 'game';
type Modal = null | 'journal' | 'menu' | 'settings' | 'import' | 'inventory' | 'shop' | 'mail' | 'skills';

/** UI scale ×2 / ×3 / ×4 (design system: ui-scale-default / -1080 / -1440). */
function resolveScale(setting: UiScale): 2 | 3 | 4 {
  if (setting !== 'auto') return setting;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w >= 2560 && h >= 1440) return 4;
  if (w >= 1920 && h >= 1080) return 3;
  return 2;
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function App() {
  const { t } = useTranslation();
  const api = useGameApi();
  const ready = useGame((s) => s.ready);
  const pending = useGame((s) => s.pendingRewards);
  const uiScaleSetting = useGame((s) => s.labs.settings.uiScale);
  const saveError = useGame((s) => s.saveError);
  const setUiBlocking = useGame((s) => s.setUiBlocking);
  const selectSlot = useGame((s) => s.selectSlot);
  const sleepRequest = useGame((s) => s.sleepRequest);
  const uiRequest = useGame((s) => s.uiRequest);
  const blocking = useGame((s) => s.uiBlocking);
  const selectedItem = useGame((s) => s.world.state.toolbar[s.selectedSlot] ?? null);
  const dialog = useGame((s) => s.dialog);
  const curriculum = useGame((s) => s.labs.curriculum);
  const day = useGame((s) => s.world.state.day);

  const [screen, setScreen] = useState<Screen>('start');
  const [modal, setModal] = useState<Modal>(null);
  const [scale, setScale] = useState(() => resolveScale(uiScaleSetting));

  // Rewards wait for the game screen; a batch is shown as one scene.
  const rewards: RewardEvent[] = screen === 'game' ? pending : [];
  const showRewards = rewards.length > 0;
  const showSleep = screen === 'game' && sleepRequest !== null && !showRewards;
  const showDialog = screen === 'game' && dialog !== null && !showRewards && !showSleep;

  // Letters (spec §6): checked when playing starts, each new day and when the plan changes.
  useEffect(() => {
    if (screen !== 'game') return;
    void api
      .getState()
      .checkMail()
      .then((fresh) => {
        if (fresh.length === 1) {
          const l = fresh[0];
          showToast({ icon: 'mail', title: t('mail.newTitle'), text: l.title, onClick: () => setModal('mail') }, 6000);
        } else if (fresh.length > 1) {
          showToast({ icon: 'mail', title: t('mail.newTitle'), text: t('mail.more', { count: fresh.length }), onClick: () => setModal('mail') }, 6000);
        }
      });
  }, [screen, curriculum, day, api, t]);

  // Over the world the cursor shows the selected toolbar item; menus keep the sword.
  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (!canvas) return;
    const id = screen === 'game' && !blocking ? selectedItem : null;
    if (!id) {
      canvas.style.cursor = '';
      return;
    }
    let live = true;
    void itemCursor(id).then((c) => {
      if (live) canvas.style.cursor = c ?? '';
    });
    return () => {
      live = false;
    };
  }, [screen, blocking, selectedItem]);

  // The world asks for windows (clicking the journal on the desk).
  useEffect(() => {
    if (uiRequest && screen === 'game') {
      const r = api.getState().takeUiRequest();
      if (r === 'journal') setModal('journal');
      else if (r === 'shop') setModal('shop');
      else if (r === 'mail') setModal('mail');
    }
  }, [uiRequest, screen, api]);

  useEffect(() => {
    const onResize = () => setScale(resolveScale(uiScaleSetting));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [uiScaleSetting]);

  useEffect(() => {
    setUiBlocking(screen !== 'game' || modal !== null || showRewards || showSleep || showDialog);
  }, [screen, modal, showRewards, showSleep, showDialog, setUiBlocking]);

  // Keyboard: J journal, Esc menu / close, 1–9 toolbar slots (spec §8 controls).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDialog && !modal) api.getState().closeDialog();
        else if (modal) setModal(null);
        else if (screen === 'game' && !showRewards && !showSleep) setModal('menu');
        return;
      }
      if (screen !== 'game' || isTyping(e)) return;
      if (showRewards || showSleep || showDialog) return;
      if (e.code === 'KeyJ') setModal((m) => (m === 'journal' ? null : m ?? 'journal'));
      else if (e.code === 'KeyI') setModal((m) => (m === 'inventory' ? null : m ?? 'inventory'));
      else if (e.code === 'KeyK') setModal((m) => (m === 'skills' ? null : m ?? 'skills'));
      else if (!modal && /^Digit[1-9]$/.test(e.code)) selectSlot(Number(e.code.slice(5)) - 1);
    };
    const onWheel = (e: WheelEvent) => {
      if (screen !== 'game' || modal || showRewards) return;
      const target = e.target as HTMLElement;
      if (target.closest('.dv-panel, .screen-overlay')) return;
      selectSlot(api.getState().selectedSlot + (e.deltaY > 0 ? 1 : -1));
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [screen, modal, showRewards, showSleep, showDialog, selectSlot, api]);

  useEffect(() => {
    if (saveError) showToast({ icon: 'warn', title: t('toast.saveErrorTitle'), text: t('toast.saveErrorText', { reason: saveError }) }, 8000);
  }, [saveError, t]);

  const enterGame = () => {
    setModal(null);
    setScreen('game');
    api.getState().beginSession();
    if (needsExportReminder(api.getState().labs.settings, new Date())) {
      showToast(
        { icon: 'upload', title: t('toast.exportTitle'), text: t('toast.exportText'), onClick: () => setModal('settings') },
        8000,
      );
    }
  };

  return (
    <div className="dv dv-ui app-ui" data-scale={scale}>
      {screen === 'start' && (
        <StartMenu onContinue={enterGame} onNewGame={() => setScreen('create')} onSettings={() => setModal('settings')} />
      )}
      {screen === 'create' && (
        <CreateCharacter
          onBack={() => setScreen('start')}
          onCreate={async (name, appearance) => {
            await api.getState().newGame(name, appearance);
            enterGame();
          }}
        />
      )}
      {screen === 'game' && ready && (
        <Hud
          onJournal={() => setModal('journal')}
          onMenu={() => setModal('menu')}
          onInventory={() => setModal('inventory')}
          onMail={() => setModal('mail')}
          onSkills={() => setModal('skills')}
        />
      )}

      {modal === 'journal' && (
        <Overlay>
          <Journal onClose={() => setModal(null)} onImport={() => setModal('import')} />
        </Overlay>
      )}
      {modal === 'menu' && (
        <Overlay dim>
          <GameMenu
            onClose={() => setModal(null)}
            onJournal={() => setModal('journal')}
            onImport={() => setModal('import')}
            onSettings={() => setModal('settings')}
            onTitle={() => {
              setModal(null);
              setScreen('start');
            }}
          />
        </Overlay>
      )}
      {modal === 'settings' && (
        <Overlay dim>
          <SettingsScreen onClose={() => setModal(null)} onImportPlan={screen === 'game' ? () => setModal('import') : undefined} />
        </Overlay>
      )}
      {modal === 'import' && <ImportScreen onClose={() => setModal(null)} />}
      {modal === 'inventory' && (
        <Overlay>
          <InventoryScreen onClose={() => setModal(null)} />
        </Overlay>
      )}
      {modal === 'mail' && (
        <Overlay>
          <MailScreen onClose={() => setModal(null)} onJournal={() => setModal('journal')} />
        </Overlay>
      )}
      {modal === 'skills' && (
        <Overlay>
          <SkillTreeScreen onClose={() => setModal(null)} />
        </Overlay>
      )}
      {showDialog && !modal && (
        <DialogBox
          key={dialog.pack + dialog.lines.join('|')}
          dialog={dialog}
          onClose={() => api.getState().closeDialog()}
          onJournal={() => {
            api.getState().closeDialog();
            setModal('journal');
          }}
        />
      )}
      {modal === 'shop' && (
        <Overlay>
          <ShopScreen onClose={() => setModal(null)} />
        </Overlay>
      )}

      {showRewards && (
        <RewardScene
          events={rewards}
          onTake={() => {
            api.getState().takeRewards();
          }}
        />
      )}
      {showSleep && (
        <SleepDialog
          reason={sleepRequest}
          lost={api.getState().lastDefeat}
          onStay={() => api.getState().cancelSleep()}
          onSleep={async () => {
            await api.getState().sleep();
            showToast({ icon: 'clock', title: t('menu.slept', { day: api.getState().world.state.day }) });
          }}
        />
      )}
      <Toasts />
      <HoverTip />
    </div>
  );
}
