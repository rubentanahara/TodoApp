using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace NotesApp.Controllers;

[ApiController]
[Route("")]
public class HealthController : ControllerBase
{
    private readonly HealthCheckService _healthCheckService;
    private readonly ILogger<HealthController> _logger;

    public HealthController(HealthCheckService healthCheckService, ILogger<HealthController> logger)
    {
        _healthCheckService = healthCheckService;
        _logger = logger;
    }

    [HttpGet("health")]
    public async Task<IActionResult> Health()
    {
        try
        {
            var healthReport = await _healthCheckService.CheckHealthAsync();
            var response = new
            {
                Status = healthReport.Status.ToString(),
                Timestamp = DateTime.UtcNow,
                TotalDuration = healthReport.TotalDuration.TotalMilliseconds,
                Results = healthReport.Entries.Select(e => new
                {
                    Name = e.Key,
                    Status = e.Value.Status.ToString(),
                    Duration = e.Value.Duration.TotalMilliseconds,
                    Description = e.Value.Description,
                    Exception = e.Value.Exception?.Message
                })
            };

            return healthReport.Status == HealthStatus.Healthy ? Ok(response) : StatusCode(503, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking health status");
            return StatusCode(503, new { Status = "Unhealthy", Error = ex.Message, Timestamp = DateTime.UtcNow });
        }
    }
    
    [HttpGet("health/ready")]
    public async Task<IActionResult> Ready()
    {
        try
        {
            var healthReport = await _healthCheckService.CheckHealthAsync();
            var response = new
            {
                Status = healthReport.Status.ToString(),
                Timestamp = DateTime.UtcNow,
                Message = "Application is ready to serve requests"
            };

            return healthReport.Status == HealthStatus.Healthy ? Ok(response) : StatusCode(503, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking readiness status");
            return StatusCode(503, new { Status = "Not Ready", Error = ex.Message, Timestamp = DateTime.UtcNow });
        }
    }
    
    [HttpGet("health/live")]
    public IActionResult Live()
    {
        return Ok(new { Status = "Live", Timestamp = DateTime.UtcNow, Message = "Application is running" });
    }
} 