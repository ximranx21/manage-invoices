import { getArticle } from "@/lib/articles";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/article-form";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) notFound();

  return <ArticleForm article={article} />;
}
