// This is what is baked by GitHub Actions
target "default" {
  inherits = ["base", "docker-metadata-action"]
}

// Targets filled by GitHub Actions
target "docker-metadata-action" {}

// This sets the platforms and is further extended by GitHub Actions to set the
// output and the cache locations
target "base" {
  platforms = [
    "linux/amd64",
    "linux/arm64",
  ]
}
