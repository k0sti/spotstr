{
  description = "Spotstr development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            bun
            jdk21
            android-tools
            gradle
          ];

          shellHook = ''
            export JAVA_HOME="${pkgs.jdk21}/lib/openjdk"
            export PATH="$JAVA_HOME/bin:$PATH"
            export ANDROID_HOME="$HOME/Android/Sdk"
            export PATH="$PATH:$ANDROID_HOME/platform-tools"

            echo "Spotstr Development Environment"
            echo "  Node: $(node --version)"
            echo "  Bun: $(bun --version)"
            echo "  Java: $(java -version 2>&1 | head -n 1)"
            echo ""
            echo "Commands:"
            echo "  bun run dev          - Start development server"
            echo "  bun run build        - Build production bundle"
            echo "  bun run android:apk  - Build Android APK"
            echo "  bun run android:run  - Run on Android device"
            echo "  bun test             - Run tests"
          '';
        };
      });
}