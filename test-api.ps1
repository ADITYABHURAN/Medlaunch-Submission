# Test Script for Reports API
# Run this after starting the server with: npm run dev

# Set base URL
$BASE_URL = "http://localhost:3000"

Write-Host "Testing Reports API" -ForegroundColor Cyan
Write-Host ""

# Step 1: Health Check
Write-Host "1. Health Check" -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
Write-Host "Server is healthy" -ForegroundColor Green
Write-Host ""

# Step 2: Generate Editor Token
Write-Host "2. Generating Editor Token" -ForegroundColor Yellow
$editorToken = Invoke-RestMethod -Uri "$BASE_URL/auth/token" -Method Post -Body (@{
    username = "alice_editor"
    role = "editor"
} | ConvertTo-Json) -ContentType "application/json"
$EDITOR_TOKEN = $editorToken.token
Write-Host "✓ Editor token generated for: $($editorToken.user.username)" -ForegroundColor Green
Write-Host ""

# Step 3: Generate Reader Token
Write-Host "3. Generating Reader Token" -ForegroundColor Yellow
$readerToken = Invoke-RestMethod -Uri "$BASE_URL/auth/token" -Method Post -Body (@{
    username = "bob_reader"
    role = "reader"
} | ConvertTo-Json) -ContentType "application/json"
$READER_TOKEN = $readerToken.token
Write-Host "✓ Reader token generated for: $($readerToken.user.username)" -ForegroundColor Green
Write-Host ""

# Step 4: Create Report
Write-Host "4. Creating Report" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $EDITOR_TOKEN"
    "Content-Type" = "application/json"
}
$newReport = Invoke-RestMethod -Uri "$BASE_URL/reports" -Method Post -Headers $headers -Body (@{
    title = "Q4 2026 Sales Analysis"
    ownerId = "user-123"
    description = "Comprehensive quarterly sales report"
    status = "draft"
    tags = @("sales", "q4", "2026")
} | ConvertTo-Json)
$REPORT_ID = $newReport.id
Write-Host "✓ Report created with ID: $REPORT_ID" -ForegroundColor Green
Write-Host ""

# Step 5: Get Report (Full View)
Write-Host "5. Fetching Report (Full View)" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $READER_TOKEN"
}
$fullReport = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Get -Headers $headers
Write-Host "✓ Retrieved report: $($fullReport.title)" -ForegroundColor Green
Write-Host ""

# Step 6: Get Report (Summary View)
Write-Host "6. Fetching Report (Summary View)" -ForegroundColor Yellow
$summaryReport = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID`?view=summary" -Method Get -Headers $headers
Write-Host "✓ Summary: $($summaryReport.totalEntries) entries, Status: $($summaryReport.status)" -ForegroundColor Green
Write-Host ""

# Step 7: Update Report (Add Entries)
Write-Host "7. Updating Report (Adding Entries)" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $EDITOR_TOKEN"
    "Content-Type" = "application/json"
}
$updatedReport = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body (@{
    status = "in_progress"
    entries = @(
        @{
            id = "entry-1"
            priority = "high"
            timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            value = @{ revenue = 150000 }
            status = "active"
            notes = "Strong Q4 performance"
        },
        @{
            id = "entry-2"
            priority = "critical"
            timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            value = @{ revenue = 200000 }
            status = "completed"
            notes = "Exceeded target"
        }
    )
} | ConvertTo-Json -Depth 10)
Write-Host "✓ Report updated: $($updatedReport.entries.Count) entries added" -ForegroundColor Green
Write-Host ""

# Step 8: Test Pagination
Write-Host "8. Testing Pagination" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $READER_TOKEN"
}
$paginatedReport = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID`?page=0`&size=1`&sortBy=priority" -Method Get -Headers $headers
Write-Host "✓ Paginated result: $($paginatedReport.entries.data.Count) of $($paginatedReport.entries.pagination.total) entries" -ForegroundColor Green
Write-Host ""

# Step 9: Test Optimistic Concurrency
Write-Host "9. Testing Optimistic Concurrency Control" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $EDITOR_TOKEN"
    "Content-Type" = "application/json"
    "If-Match" = "$($updatedReport.version)"
}
$concurrentUpdate = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body (@{
    tags = @("sales", "q4", "2026", "updated")
} | ConvertTo-Json)
Write-Host "✓ Concurrent update succeeded with version check" -ForegroundColor Green
Write-Host ""

# Step 10: Finalize Report
Write-Host "10. Finalizing Report" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $EDITOR_TOKEN"
    "Content-Type" = "application/json"
}
$finalizedReport = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body (@{
    status = "finalized"
} | ConvertTo-Json)
Write-Host "✓ Report finalized" -ForegroundColor Green
Write-Host ""

# Step 11: Test Finalized Protection
Write-Host "11. Testing Finalized Status Protection (Should Fail)" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $EDITOR_TOKEN"
    "Content-Type" = "application/json"
}
try {
    $failedUpdate = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body (@{
        title = "Modified Title"
    } | ConvertTo-Json)
    Write-Host "✗ Should have failed!" -ForegroundColor Red
} catch {
    Write-Host "✓ Correctly rejected edit without force=true" -ForegroundColor Green
}
Write-Host ""

# Step 12: Test Forced Edit
Write-Host "12. Testing Forced Edit on Finalized Report" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $EDITOR_TOKEN"
    "Content-Type" = "application/json"
}
$forcedUpdate = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body (@{
    title = "Q4 2026 Sales Analysis (FINAL)"
    force = $true
} | ConvertTo-Json)
Write-Host "✓ Forced edit succeeded" -ForegroundColor Green
Write-Host ""

# Step 13: Create Test File for Upload
Write-Host "13. Testing File Upload" -ForegroundColor Yellow
$testFile = "$env:TEMP\test-report.txt"
"This is a test report attachment." | Out-File -FilePath $testFile -Encoding utf8

$headers = @{
    "Authorization" = "Bearer $EDITOR_TOKEN"
}
$form = @{
    file = Get-Item -Path $testFile
}
$uploadResponse = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID/attachment" -Method Post -Headers $headers -Form $form
Write-Host "✓ File uploaded: $($uploadResponse.attachment.originalName)" -ForegroundColor Green
Write-Host "  Download URL: $($uploadResponse.downloadUrl)" -ForegroundColor Gray
Write-Host ""

# Step 14: Test Reader Permissions (Should Fail)
Write-Host "14. Testing Reader Permissions (Should Fail)" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $READER_TOKEN"
    "Content-Type" = "application/json"
}
try {
    $unauthorizedUpdate = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body (@{
        title = "Unauthorized Update"
    } | ConvertTo-Json)
    Write-Host "✗ Should have failed!" -ForegroundColor Red
} catch {
    Write-Host "✓ Correctly rejected reader attempting to edit" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "🎉 All tests completed!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Report ID: $REPORT_ID"
Write-Host "  Final Version: $($forcedUpdate.version)"
Write-Host "  Total Entries: $($forcedUpdate.entries.Count)"
Write-Host "  Total Audit Log Entries: $($forcedUpdate.auditLog.Count)"
Write-Host ""
Write-Host "You can now:" -ForegroundColor Yellow
Write-Host "  • View logs in combined.log and error.log"
Write-Host "  • Check uploads/ directory for uploaded files"
Write-Host "  • Try additional API calls with the tokens above"
Write-Host ""

# Clean up
Remove-Item $testFile -ErrorAction SilentlyContinue
