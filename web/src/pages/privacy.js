/** @jsxRuntime classic */
/** @jsx jsx */
import Layout from "components/layout";
import React from "react";
import SectionHeading from "../components/section-heading";
import { jsx, Text } from "theme-ui";

const privacy = () => {
  const content = [
    {
      title: "Introduction",
      description: `SpringRole Inc.\n hereinafter referred as Springworks ("us", "we", or "our") operates https://springworks.in/ (the "Site") and has issued this Global Data Protection and Privacy Policy (“Policy”). This page informs you of our policies regarding the collection, use and disclosure of Personal Information we receive from users of the Site. Please read the entire Policy carefully it forms a contract between You (“Customer”) and Us.<br/><br/>
      This Policy will apply where We are Controllers or Processors of personal data. This policy is applicable to Our Products (web platform, mobile applications, API based clients) and to Our public Site https://springworks.in/ <br/><br/>
      We use your Personal Information only for providing and improving the Site. By using the Site, you agree to the collection and use of information in accordance with this policy. If you are in any doubt regarding the applicable standards, or have any comments or questions about this Policy, please contact us at the contact details provided under this Policy.`,
    },
  ];
  return (
    <Layout>
      <SectionHeading title="Privacy Policy" />
      {content.map(({ title, description }, index) => {
        return (
          <div sx={styles.item}>
            <Text as="h4">
              {index + 1}. {title}
            </Text>
            <Text as="p" dangerouslySetInnerHTML={{ __html: description }} />
          </div>
        );
      })}
    </Layout>
  );
};

export default privacy;

const styles = {
  item: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
};
