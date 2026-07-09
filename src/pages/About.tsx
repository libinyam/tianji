import Hero from "@/components/home/Hero";
import ModuleCards from "@/components/home/ModuleCards";
import VisionBand from "@/components/home/VisionBand";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/** 关于页：品牌故事 + 模块介绍 + 愿景。原营销首页精简而来，根路径已让位给讨论区。 */
export default function About() {
  useDocumentTitle("关于");
  return (
    <>
      <Hero />
      <ModuleCards />
      <VisionBand />
    </>
  );
}
