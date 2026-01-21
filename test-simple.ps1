# Simple Test Script for Reports API

$BASE_URL = "http://localhost:3000"

Write-Host "`n=== Testing Reports API ===`n" -ForegroundColor Cyan

try {
    # 1. Health Check
    Write-Host "1. Health Check..." -ForegroundColor Yellow
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "   SUCCESS: Server is running" -ForegroundColor Green
    
    # 2. Generate Editor Token
    Write-Host "`n2. Generating Editor Token..." -ForegroundColor Yellow
    $tokenBody = @{
        username = "john_editor"
        role = "editor"
    } | ConvertTo-Json
    
    $editorResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/token" -Method Post -Body $tokenBody -ContentType "application/json"
    $EDITOR_TOKEN = $editorResponse.token
    Write-Host "   SUCCESS: Token generated for $($editorResponse.user.username)" -ForegroundColor Green
    
    # 3. Create Report
    Write-Host "`n3. Creating Report..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $EDITOR_TOKEN"
        "Content-Type" = "application/json"
    }
    
    $reportBody = @{
        title = "Q4 2026 Sales Report"
        ownerId = "user-123"
        description = "Quarterly sales analysis"
        status = "draft"
        tags = @("sales", "q4")
    } | ConvertTo-Json
    
    $newReport = Invoke-RestMethod -Uri "$BASE_URL/reports" -Method Post -Headers $headers -Body $reportBody
    $REPORT_ID = $newReport.id
    Write-Host "   SUCCESS: Report created with ID: $REPORT_ID" -ForegroundColor Green
    
    # 4. Get Report
    Write-Host "`n4. Fetching Report..." -ForegroundColor Yellow
    $report = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Get -Headers $headers
    Write-Host "   SUCCESS: Retrieved report '$($report.title)'" -ForegroundColor Green
    
    # 5. Get Summary View
    Write-Host "`n5. Fetching Summary View..." -ForegroundColor Yellow
    $summaryUrl = "$BASE_URL/reports/$REPORT_ID" + "?view=summary"
    $summary = Invoke-RestMethod -Uri $summaryUrl -Method Get -Headers $headers
    Write-Host "   SUCCESS: Summary - $($summary.totalEntries) entries, Status: $($summary.status)" -ForegroundColor Green
    
    # 6. Update Report
    Write-Host "`n6. Updating Report..." -ForegroundColor Yellow
    $updateBody = @{
        status = "in_progress"
        entries = @(
            @{
                id = "entry-1"
                priority = "high"
                timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                value = @{ revenue = 150000 }
                status = "active"
                notes = "Strong Q4 performance"
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $updatedReport = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body $updateBody
    Write-Host "   SUCCESS: Report updated - $($updatedReport.entries.Count) entries" -ForegroundColor Green
    
    # 7. Finalize Report
    Write-Host "`n7. Finalizing Report..." -ForegroundColor Yellow
    $finalizeBody = @{
        status = "finalized"
    } | ConvertTo-Json
    
    $finalizedReport = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body $finalizeBody
    Write-Host "   SUCCESS: Report finalized (Version: $($finalizedReport.version))" -ForegroundColor Green
    
    # 8. Test Finalized Protection (should fail)
    Write-Host "`n8. Testing Finalized Protection (should fail)..." -ForegroundColor Yellow
    try {
        $invalidBody = @{
            title = "Modified Title"
        } | ConvertTo-Json
        
        $failed = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body $invalidBody
        Write-Host "   ERROR: Should have been rejected!" -ForegroundColor Red
    } catch {
        Write-Host "   SUCCESS: Correctly rejected edit without force=true" -ForegroundColor Green
    }
    
    # 9. Force Edit
    Write-Host "`n9. Testing Forced Edit on Finalized Report..." -ForegroundColor Yellow
    $forceBody = @{
        title = "Q4 2026 Sales Report (FINALIZED)"
        force = $true
    } | ConvertTo-Json
    
    $forcedUpdate = Invoke-RestMethod -Uri "$BASE_URL/reports/$REPORT_ID" -Method Put -Headers $headers -Body $forceBody
    Write-Host "   SUCCESS: Forced edit succeeded (Version: $($forcedUpdate.version))" -ForegroundColor Green
    
    Write-Host "`n=== All Tests Passed! ===`n" -ForegroundColor Green
    Write-Host "Final Report Details:" -ForegroundColor Cyan
    Write-Host "  Report ID: $REPORT_ID"
    Write-Host "  Title: $($forcedUpdate.title)"
    Write-Host "  Status: $($forcedUpdate.status)"
    Write-Host "  Version: $($forcedUpdate.version)"
    Write-Host "  Total Entries: $($forcedUpdate.entries.Count)"
    Write-Host "  Audit Log Entries: $($forcedUpdate.auditLog.Count)"
    Write-Host ""
    
} catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure the server is running with 'npm run dev'" -ForegroundColor Yellow
}
