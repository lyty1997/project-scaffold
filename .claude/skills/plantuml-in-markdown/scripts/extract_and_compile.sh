#!/usr/bin/env bash
# Extract every Markdown PlantUML block, compile each one, and keep the extracted
# sources available for the required write-back step.
set -u

markdown_path="${1:?markdown file path required}"
output_dir="${2:-}"
plantuml_jar="${PUML_JAR:-}"

if [ ! -f "$markdown_path" ]; then
  echo "ERROR: Markdown file not found: $markdown_path" >&2
  exit 2
fi
if [ -z "$plantuml_jar" ]; then
  echo "ERROR: PUML_JAR is not set. Point it to a local plantuml.jar." >&2
  exit 2
fi
if [ ! -f "$plantuml_jar" ]; then
  echo "ERROR: plantuml.jar not found: $plantuml_jar" >&2
  exit 2
fi

if [ -z "$output_dir" ]; then
  output_dir="$(mktemp -d)"
else
  mkdir -p "$output_dir"
  if find "$output_dir" -maxdepth 1 -type f -name 'g*.puml' -print -quit | grep -q .; then
    echo "ERROR: output directory already contains g*.puml files: $output_dir" >&2
    exit 2
  fi
fi

awk -v outdir="$output_dir" '
/^```plantuml$/ { in_block=1; count++; file=sprintf("%s/g%02d.puml", outdir, count); next }
/^```$/ && in_block { in_block=0; next }
in_block { print > file }
' "$markdown_path"

count="$(find "$output_dir" -maxdepth 1 -type f -name 'g*.puml' | wc -l)"
if [ "$count" = "0" ]; then
  echo "No PlantUML blocks found in $markdown_path"
  exit 0
fi

echo "Found $count PlantUML block(s); compiling in SECURE mode."
failures=0
for source_path in "$output_dir"/g*.puml; do
  base="$(basename "$source_path" .puml)"
  png_path="$output_dir/$base.png"
  error_path="$output_dir/$base.err"
  java -DPLANTUML_SECURITY_PROFILE=SECURE -jar "$plantuml_jar" -failfast2 -pipe \
    < "$source_path" > "$png_path" 2> "$error_path"
  status=$?
  if [ "$status" -ne 0 ] || [ ! -s "$png_path" ]; then
    echo "FAIL $base (exit=$status)"
    sed -n '1,3p' "$error_path"
    failures=$((failures + 1))
  else
    dimensions="$(file "$png_path" 2>/dev/null | grep -oE '[0-9]+ x [0-9]+' || true)"
    echo "OK   $base (${dimensions:-dimensions unavailable})"
    if [ -s "$error_path" ]; then
      echo "     note: compiler wrote non-fatal stderr; inspect $error_path"
    fi
  fi
done

echo "Sources and images: $output_dir"
echo "Total: $count; failures: $failures"
exit "$failures"
