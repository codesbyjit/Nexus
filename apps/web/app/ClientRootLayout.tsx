"use client";

import { ReactNode, useEffect, useState } from "react";

export default function ClientFonts({
  children,
  geistSans,
  geistMono,
}: {
  children: ReactNode;
  geistSans: string;
  geistMono: string;
}) {
  const [fontClasses, setFontClasses] = useState("");

  useEffect(() => {
    setFontClasses(`${geistSans} ${geistMono}`);
  }, [geistSans, geistMono]);

  return <div className={fontClasses}>{children}</div>;
}
