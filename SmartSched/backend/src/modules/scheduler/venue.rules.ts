export type VenueRequirement = {
  roomTypeId?: string | null;
  minCapacity?: number | null;
  equipment?: string | null;
};
export type Venue = {
  capacity: number;
  roomTypeId?: string | null;
  equipment?: string | null;
  hasProjector?: boolean;
  hasAC?: boolean;
  hasWhiteboard?: boolean;
};

export function equipmentNames(value?: string | null): string[] {
  return [
    ...new Set(
      (value || '')
        .split(/[,;\n]/)
        .map((item) => item.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter(Boolean)
    ),
  ];
}

export function venueSatisfies(
  venue: Venue,
  capacity: number,
  requirements: VenueRequirement[] = []
): boolean {
  if (venue.capacity < capacity) return false;
  const equipment = new Set(equipmentNames(venue.equipment));
  if (venue.hasProjector) equipment.add('projector');
  if (venue.hasAC) equipment.add('ac');
  if (venue.hasWhiteboard) equipment.add('whiteboard');
  return requirements.every(
    (requirement) =>
      (!requirement.roomTypeId || requirement.roomTypeId === venue.roomTypeId) &&
      (!requirement.minCapacity || venue.capacity >= requirement.minCapacity) &&
      equipmentNames(requirement.equipment).every((item) => equipment.has(item))
  );
}
