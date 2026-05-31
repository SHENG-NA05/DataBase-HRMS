import "./globals.css";
import { AppProvider } from "../components/AppContext";

export const metadata = {
  title: "人力資源派遣公司管理系統 (HRMS)",
  description: "國立高雄師範大學資料庫期末專題設計 - 人力資源派遣管理平台",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
