package cc.miab.lead_generation;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Disabled in local CI/build environments without PostgreSQL service running")
class LeadGenerationApplicationTests {

	@Test
	void contextLoads() {
	}

}
