import './globals.css';
export const metadata = { title: process.env.NEXT_PUBLIC_APP_NAME || 'PTO Portal' };
export default function RootLayout({ children }:{children:React.ReactNode}){
  return (<html lang="en"><body className="min-h-screen bg-slate-50 text-slate-900">{children}</body></html>);
}
