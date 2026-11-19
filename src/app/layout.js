import { Roboto } from "next/font/google";
import "./globals.css";
import OfflineRegistrar from "./components/OfflineRegistrar";
import MuiAppThemeProvider from "./ui/MuiAppThemeProvider";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata = {
  title: "SIMA | Tristone",
  description: "Sistema de monitoreo de aforo de camiones",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${roboto.variable} ${roboto.className}`}>
        <MuiAppThemeProvider>
          <OfflineRegistrar />
          {children}
        </MuiAppThemeProvider>
      </body>
    </html>
  );
}
