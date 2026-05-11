type RecordMapContributionFrontComponent = {
  id: string;
  universalIdentifier?: string | null;
};

export const resolveRecordMapContributionFrontComponentId = ({
  frontComponents,
  frontComponentUniversalIdentifier,
}: {
  frontComponents: RecordMapContributionFrontComponent[];
  frontComponentUniversalIdentifier?: string | null;
}) => {
  if (!frontComponentUniversalIdentifier) {
    return null;
  }

  return (
    frontComponents.find(
      (frontComponent) =>
        frontComponent.universalIdentifier ===
        frontComponentUniversalIdentifier,
    )?.id ?? null
  );
};
