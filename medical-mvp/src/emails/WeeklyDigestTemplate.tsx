import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

export type WeeklyDigestTemplateProps = {
  firstName: string;
  paragraphs: string[];
  dashboardUrl: string;
};

const fontFamily =
  'Tahoma, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function WeeklyDigestTemplate({
  firstName,
  paragraphs,
  dashboardUrl,
}: WeeklyDigestTemplateProps) {
  return (
    <Html lang="fa" dir="rtl">
      <Head />
      <Preview>گزارش پیشرفت هفتگی PedsMorningAI</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Heading style={headingStyle}>گزارش پیشرفت هفتگی PedsMorningAI</Heading>
          </Section>

          <Section style={contentStyle}>
            <Text style={greetingStyle}>{firstName} عزیز،</Text>
            {paragraphs.map((paragraph, index) => (
              <Text key={index} style={paragraphStyle}>
                {paragraph}
              </Text>
            ))}
          </Section>

          <Hr style={hrStyle} />

          <Section style={footerStyle}>
            <Button href={dashboardUrl} style={buttonStyle}>
              ادامه مطالعه در داشبورد
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderWeeklyDigestHtml(
  props: WeeklyDigestTemplateProps,
): Promise<string> {
  return render(<WeeklyDigestTemplate {...props} />);
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f4f7fb",
  margin: 0,
  padding: "24px 12px",
  fontFamily,
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  margin: "0 auto",
  maxWidth: "560px",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#0f766e",
  padding: "24px 28px",
};

const headingStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "1.5",
  margin: 0,
  textAlign: "right",
};

const contentStyle: React.CSSProperties = {
  padding: "24px 28px",
};

const greetingStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: 600,
  lineHeight: "1.8",
  margin: "0 0 16px",
  textAlign: "right",
};

const paragraphStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "1.9",
  margin: "0 0 14px",
  textAlign: "right",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "0",
};

const footerStyle: React.CSSProperties = {
  padding: "24px 28px 28px",
  textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#0f766e",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
};
