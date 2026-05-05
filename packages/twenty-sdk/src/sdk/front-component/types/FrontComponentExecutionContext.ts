export type FrontComponentExecutionContext = {
  frontComponentId: string;
  userId: string | null;
  recordId: string | null;
  params?: Record<string, string>;
};
