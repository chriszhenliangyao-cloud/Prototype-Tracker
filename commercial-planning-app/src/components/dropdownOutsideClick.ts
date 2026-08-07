export function isOutsideDropdownTarget(
  root: Pick<Node, "contains"> | null,
  target: EventTarget | null
) {
  if (!root || !target) {
    return false;
  }

  return !root.contains(target as Node);
}
