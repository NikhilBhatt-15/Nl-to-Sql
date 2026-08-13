import QueryChat from "../components/QueryChat";

export default function Home() {
  return (
    <main>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
          Ask Questions
        </h1>
        <p style={{ color: "#9a9a9a", margin: 0 }}>
          Ask a question about the database in plain English.
        </p>
      </div>
      <QueryChat />
    </main>
  );
}
