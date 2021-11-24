import { useEffect } from "react";
import Router from "next/router";
import Layout from "components/layout";
import { ThemeProvider, Container } from "theme-ui";
import theme from "theme";
import { initGA, logPageView } from "analytics";
import "rc-tabs/assets/index.css";
import "swiper/swiper-bundle.min.css";
import "rc-drawer/assets/index.css";

export default function CustomApp({ Component, pageProps }) {
  useEffect(() => {
    initGA();
    logPageView();
    Router.events.on("routeChangeComplete", logPageView);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Container>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </Container>
    </ThemeProvider>
  );
}
