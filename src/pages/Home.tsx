import Hero from "@/components/home/Hero";
import ModuleCards from "@/components/home/ModuleCards";
import VisionBand from "@/components/home/VisionBand";
import FeaturedFeed from "@/components/home/FeaturedFeed";
import CommunityStats from "@/components/home/CommunityStats";

export default function Home() {
  return (
    <>
      <Hero />
      <ModuleCards />
      <VisionBand />
      <FeaturedFeed />
      <CommunityStats />
    </>
  );
}
