{
  description = "Spotstr Android development environment";

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
            jdk21
            android-tools
            gradle
            nodejs_20
            bun
          ];

          shellHook = ''
            export JAVA_HOME="${pkgs.jdk21}/lib/openjdk"
            export PATH="$JAVA_HOME/bin:$PATH"
            export ANDROID_HOME="$HOME/Android/Sdk"
            export PATH="$PATH:$ANDROID_HOME/platform-tools"

            echo "Development environment loaded:"
            echo "  Java: $(java -version 2>&1 | head -n 1)"
            echo "  Gradle: $(gradle --version | head -n 3 | tail -n 1)"
            echo "  Node: $(node --version)"
            echo "  Bun: $(bun --version)"
          '';
        };
      });
}