const SQL_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const assertGeoReferenceSqlIdentifier = (identifier: string) => {
  if (!SQL_IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
};

export const quoteGeoReferenceSqlIdentifier = (identifier: string) => {
  assertGeoReferenceSqlIdentifier(identifier);

  return `"${identifier}"`;
};

export const quoteGeoReferenceSqlQualifiedName = ({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}) =>
  `${quoteGeoReferenceSqlIdentifier(schemaName)}.${quoteGeoReferenceSqlIdentifier(tableName)}`;
