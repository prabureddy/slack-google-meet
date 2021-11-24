import facebook from "assets/images/icons/facebook.png";
import twitter from "assets/images/icons/twitter.png";
import github from "assets/images/icons/github.png";
import dribbble from "assets/images/icons/dribbble.png";
import linkedin from "assets/images/icons/linkedin.png";

export const menuItems = [
  {
    id: 2,
    title: "About Us",
    items: [
      {
        path: "mailto:bhargava.prabu@gmail.com",
        label: "Support Center",
        external: true,
      },
      // {
      //   path: "#!",
      //   label: "Customer Support",
      // },
      {
        path: "#!",
        label: "About Us",
      },
      // {
      //   path: "#!",
      //   label: "Copyright",
      // },
      // {
      //   path: "#!",
      //   label: "Popular Campaign",
      // },
    ],
  },
  // {
  //   id: 3,
  //   title: "Our Information",
  //   items: [
  //     {
  //       path: "#!",
  //       label: "Return Policy ",
  //     },
  //     {
  //       path: "#!",
  //       label: "Privacy Policy",
  //     },
  //     {
  //       path: "#!",
  //       label: "Terms & Conditions",
  //     },
  //     {
  //       path: "#!",
  //       label: "Site Map",
  //     },
  //     {
  //       path: "#!",
  //       label: "Store Hours",
  //     },
  //   ],
  // },
  // {
  //   id: 4,
  //   title: "My Account",
  //   items: [
  //     {
  //       path: "#!",
  //       label: "Press inquiries",
  //     },
  //     {
  //       path: "#!",
  //       label: "Social media ",
  //     },
  //     {
  //       path: "#!",
  //       label: "directories",
  //     },
  //     {
  //       path: "#!",
  //       label: "Images & B-roll",
  //     },
  //     {
  //       path: "#!",
  //       label: "Permissions",
  //     },
  //   ],
  // },
  {
    id: 5,
    title: "Connect",
    items: [
      // {
      //   path: '#!',
      //   icon: facebook,
      //   label: 'Facebook',
      // },
      {
        path: "https://twitter.com/BhargavaPrabu",
        icon: twitter,
        label: "Twitter",
        external: true,
      },
      {
        path: "https://github.com/prabureddy",
        icon: github,
        label: "Github",
        external: true,
      },
      {
        path: "https://www.linkedin.com/in/prabureddy/",
        icon: linkedin,
        label: "LinkedIn",
        external: true,
      },
    ],
  },
];

export const footerNav = [
  {
    path: "#!",
    label: "Home",
  },
  {
    path: "#!",
    label: "Advertise",
  },
  {
    path: "#!",
    label: "Supports",
  },
  {
    path: "#!",
    label: "Marketing",
  },
  {
    path: "#!",
    label: "FAQ",
  },
];
