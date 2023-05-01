{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/release-22.11";

    flake-utils.url = "github:numtide/flake-utils";

    flake-compat = {
      url = "github:edolstra/flake-compat";
      flake = false;
    };

    devshell = {
      url = "github:numtide/devshell";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    pact-nix = {
      url = "github:thomashoneyman/pact-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
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
        overlays = [pactOverlay devshell.overlays.default];
      };
    in {
      devShell = pkgs.devshell.mkShell {
        imports = [(pkgs.devshell.importTOML ./devshell.toml)];
      };
    });
}
