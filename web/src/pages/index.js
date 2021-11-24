import SEO from "components/seo";
import Banner from "sections/banner";
import Services from "sections/services";
import Testimonials from "sections/testimonials";
import OurTeam from "sections/our-team";
import OtherServices from "sections/other-services";
import WhyUs from "sections/why-us";
import SubscribeUs from "sections/subscribe-us";
import Blog from "sections/blog";

export default function IndexPage() {
  return (
    <div>
      <SEO
        title="Google Meet for Slack"
        description="Open Google meet from slack using one command"
      />
      <Banner />
      {/* <Services />
        <Testimonials />
        <OurTeam />
        <OtherServices />
        <WhyUs />
        <Blog />
        <SubscribeUs /> */}
    </div>
  );
}
