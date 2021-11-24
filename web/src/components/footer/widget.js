/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, Box, Heading, Image } from "theme-ui";
import { Link } from "components/link";
import { rgba } from "polished";

const Widget = ({ title, items }) => {
  return (
    <Box sx={styles.footerWidget}>
      <Heading as="h4">{title}</Heading>
      <ul>
        {items.map(({ path, label, icon, external }, i) => (
          <li key={i}>
            {icon && <Image src={icon} style={{ width: 20 }} alt={label} />}
            <Link
              path={path}
              key={i}
              style={{ cursor: "pointer" }}
              label={label}
              variant="footer"
              {...(external && {
                href: path,
                target: "_blank",
              })}
            />
          </li>
        ))}
      </ul>
    </Box>
  );
};

export default Widget;

const styles = {
  footerWidget: {
    h4: {
      color: "heading",
      fontFamily: "body",
      fontSize: "18px",
      fontWeight: 500,
      lineHeight: 1.68,
      letterSpacing: "heading",
    },
    ul: {
      listStyle: "none",
      margin: "28px 0 0",
      padding: 0,
      li: {
        display: "flex",
        alignItems: "center",
        img: {
          mr: "15px",
        },
      },
      a: {
        color: rgba("#02073E", 0.8),
      },
    },
  },
};
