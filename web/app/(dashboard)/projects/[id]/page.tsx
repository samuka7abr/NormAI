import { ProjectPage } from "@/components/projects/project-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectPage projectId={id} />;
}
