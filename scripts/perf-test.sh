#!/bin/bash
# Performance test wrapper
echo "Running performance tests..."
echo ""

for scale in small medium large; do
    npx tsx scripts/perf-test.ts --scale=$scale
    echo ""
    echo "Press Enter to continue to next scale..."
    read
done

echo "All performance tests complete."
