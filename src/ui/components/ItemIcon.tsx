import { ITEMS, type ItemIcon as ItemIconDef } from '@/core/items';
import { ASSETS, type SheetAsset } from '@/game/assets/manifest';

import { SheetIcon, assetUrl } from './common';

function Icon({ icon, scale, label }: { icon: ItemIconDef; scale: number; label?: string }) {
  const { sheet, frame, texture } = icon;
  if (sheet !== undefined && frame !== undefined) {
    const a = ASSETS[sheet] as SheetAsset;
    return <SheetIcon sheet={sheet} frame={frame} columns={a.columns} spacing={a.spacing ?? 0} scale={scale} label={label} />;
  }
  // Textures may be bigger than a slot (furniture): fitted inside the 16×16 box.
  if (texture)
    return (
      <img
        src={assetUrl(texture)}
        alt={label ?? ''}
        width={16 * scale}
        height={16 * scale}
        className="dv-px"
        style={{ objectFit: 'contain' }}
      />
    );
  return null;
}

/** Picture of a unique lab item: its own drawing, or the pack's placeholder for a pack without art. */
export function uniqueIconUrl(itemId: string, fallback: string): string {
  return assetUrl(ASSETS[`item-${itemId}`] ? `item-${itemId}` : fallback);
}

/** The 16×16 icon of a catalog item, drawn ×2 (or `scale`); seeds get their crop in the corner. */
export function ItemIcon({ id, scale = 2 }: { id: string; scale?: number }) {
  const item = ITEMS[id];
  if (!item) return null;
  if (!item.badge) return <Icon icon={item.icon} scale={scale} label={item.name} />;
  return (
    <span className="item-icon" style={{ width: 16 * scale, height: 16 * scale }}>
      <Icon icon={item.icon} scale={scale} label={item.name} />
      <span className="item-icon__badge">
        <Icon icon={item.badge} scale={Math.max(1, scale / 2)} />
      </span>
    </span>
  );
}
