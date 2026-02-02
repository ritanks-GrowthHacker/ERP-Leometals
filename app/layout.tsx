import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AlertProvider } from "@/components/common/CustomAlert";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Leo Metals ERP - Enterprise Resource Planning",
  description: "Complete ERP solution for Leo Metals - managing inventory, purchasing, sales, and manufacturing operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className="antialiased bg-gray-50 text-gray-900">
        <AlertProvider>
          {children}
        </AlertProvider>
      </body>
    </html>
  );
}
