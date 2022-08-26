{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/release-22.05";
    flake-utils.url = "github:numtide/flake-utils";
    devshell.url = "github:numtide/devshell";
    pact-nix.url = "github:thomashoneyman/pact-nix/main";
  };

  outputs = {
    self,
    nixpkgs,
    pact-nix,
    flake-utils,
    devshell,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pactOverlay = _: _: {
        pact = pact-nix.packages.${system}.pact;
      };

      pkgs = import nixpkgs {
        inherit system;
        overlays = [pactOverlay devshell.overlay];
      };
    in {
      devShell = pkgs.devshell.mkShell {
        imports = [(pkgs.devshell.importTOML ./devshell.toml)];
      };
    });
}
