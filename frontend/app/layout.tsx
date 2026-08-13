import "./globals.css";
import Navigation from "../components/Navigation";

export const metadata = {
  title: "NL-to-SQL Assistant",
  description: "Ask your database a question in plain English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0d1117", color: "#e6e6e6", fontFamily: "Arial, sans-serif" }}>
        <Navigation />
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem", paddingTop: "1rem" }}>
          {children}
        </div>
      </body>
    </html>
  );
}