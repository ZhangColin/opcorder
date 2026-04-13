{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.source-han-sans
    pkgs.alsa-lib
    pkgs.expat
    pkgs.mesa
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.cairo
    pkgs.pango
    pkgs.dbus
    pkgs.cups
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
