// Terrain tile types. Values are stored directly in GameMap.tiles (Uint8Array).

export const TileType = { Water: 0, Sand: 1, Grass: 2, Rock: 3 } as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

export const TILE_NAMES: Record<TileType, string> = {
  [TileType.Water]: 'Water',
  [TileType.Sand]: 'Sand',
  [TileType.Grass]: 'Grass',
  [TileType.Rock]: 'Rock',
};
