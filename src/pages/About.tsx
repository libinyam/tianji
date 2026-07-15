import AICreationTimeline from "@/components/home/AICreationTimeline";
import GrowthStats from "@/components/home/GrowthStats";
import Hero from "@/components/home/Hero";
import ModuleCards from "@/components/home/ModuleCards";
import VisionBand from "@/components/home/VisionBand";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/** 关于页：品牌故事 + 模块介绍 + 成长数据 + AI 共创过程 + 愿景。根路径已让位给讨论区。 */
export default function About() {
  useDocumentTitle("关于");
  return (
    <>
      <Hero />
      <ModuleCards />
      <GrowthStats />
      <AICreationTimeline />
      <VisionBand />
    </>
  );
}
