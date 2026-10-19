package cc.miab.lead_generation.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.concurrent.Executor;

@Configuration
@EnableScheduling
@EnableAsync
public class SchedulerConfig {

    @Bean(name = "outreachTaskExecutor")
    public Executor outreachTaskExecutor() {
        SimpleAsyncTaskExecutor executor = new SimpleAsyncTaskExecutor("outreach-worker-");
        executor.setVirtualThreads(true);
        return executor;
    }
}
