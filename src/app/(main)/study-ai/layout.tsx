import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Study with AI",
    template: "%s | Study with AI",
  },
  description: "Generate AI-powered study materials from your content",
};

export default function StudyAILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
