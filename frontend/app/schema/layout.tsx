export default function SchemaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ 
      margin: 0, 
      padding: 0, 
      height: "calc(100vh - 60px)", // Subtract navigation height
      width: "100%",
      overflow: "hidden"
    }}>
      {children}
    </div>
  );
}