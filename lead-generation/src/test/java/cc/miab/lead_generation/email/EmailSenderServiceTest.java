package cc.miab.lead_generation.email;

import jakarta.mail.Address;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailSenderServiceTest {

    @Mock
    private JavaMailSender defaultMailSender;

    private EmailSenderService emailSenderService;

    @BeforeEach
    void setUp() {
        // relayUrl set to empty string to test the dynamic direct SMTP / MimeMessageHelper path
        emailSenderService = new EmailSenderService(
                defaultMailSender,
                "default@company.com",
                ""
        );
    }

    @Test
    void testParseEmailList_CommaSeparatedWithSpaces() {
        String input = "manager@company.com, audit@company.com";
        String[] result = emailSenderService.parseEmailList(input);

        assertArrayEquals(new String[]{"manager@company.com", "audit@company.com"}, result);
    }

    @Test
    void testParseEmailList_ExcessiveSpacesAndAngleBrackets() {
        String input = "  <ceo@company.com> ,   manager@company.com  ; <audit@company.com>  ";
        String[] result = emailSenderService.parseEmailList(input);

        assertArrayEquals(new String[]{"ceo@company.com", "manager@company.com", "audit@company.com"}, result);
    }

    @Test
    void testParseEmailList_EmptyAndNullSafeguard() {
        assertArrayEquals(new String[0], emailSenderService.parseEmailList(null));
        assertArrayEquals(new String[0], emailSenderService.parseEmailList(""));
        assertArrayEquals(new String[0], emailSenderService.parseEmailList("   "));
        assertArrayEquals(new String[0], emailSenderService.parseEmailList(" , , ; "));
    }

    @Test
    void testSendEmail_WithCcAndBcc_SetsRecipientsOnMimeMessage() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(defaultMailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailSenderService.sendEmail(
                "lead@client.com",
                "Product Overview",
                "Hello world",
                "sender@company.com",
                null, // null password uses defaultMailSender mock
                "Sales Rep",
                "smtp.company.com",
                587,
                "manager@company.com, audit@company.com",
                "bcc1@company.com, bcc2@company.com"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(defaultMailSender).send(captor.capture());

        MimeMessage sentMessage = captor.getValue();
        assertNotNull(sentMessage);

        // Check TO
        Address[] toRecipients = sentMessage.getRecipients(Message.RecipientType.TO);
        assertNotNull(toRecipients);
        assertEquals(1, toRecipients.length);
        assertEquals("lead@client.com", toRecipients[0].toString());

        // Check CC
        Address[] ccRecipients = sentMessage.getRecipients(Message.RecipientType.CC);
        assertNotNull(ccRecipients, "CC recipients must be bound to MimeMessage");
        assertEquals(2, ccRecipients.length);
        assertEquals("manager@company.com", ccRecipients[0].toString());
        assertEquals("audit@company.com", ccRecipients[1].toString());

        // Check BCC
        Address[] bccRecipients = sentMessage.getRecipients(Message.RecipientType.BCC);
        assertNotNull(bccRecipients, "BCC recipients must be bound to MimeMessage");
        assertEquals(2, bccRecipients.length);
        assertEquals("bcc1@company.com", bccRecipients[0].toString());
        assertEquals("bcc2@company.com", bccRecipients[1].toString());
    }

    @Test
    void testSendEmail_EmptyCheckSafeguard_DoesNotSetCcOrBccHeaders() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(defaultMailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailSenderService.sendEmail(
                "lead@client.com",
                "Direct Message",
                "No CC or BCC",
                "sender@company.com",
                null,
                "Sales Rep",
                "smtp.company.com",
                587,
                "   ",   // Empty after trimming
                null     // Null BCC
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(defaultMailSender).send(captor.capture());

        MimeMessage sentMessage = captor.getValue();
        assertNotNull(sentMessage);

        // CC and BCC must remain null
        assertNull(sentMessage.getRecipients(Message.RecipientType.CC), "CC header must not be set when empty/whitespace");
        assertNull(sentMessage.getRecipients(Message.RecipientType.BCC), "BCC header must not be set when null");
    }

    @Test
    void testSendEmail_SingleRecipientCcBcc() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(defaultMailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailSenderService.sendEmail(
                "lead@client.com",
                "Single CC",
                "Body",
                "sender@company.com",
                null,
                "Sales Rep",
                "smtp.company.com",
                587,
                "single-cc@company.com",
                "single-bcc@company.com"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(defaultMailSender).send(captor.capture());

        MimeMessage sentMessage = captor.getValue();
        Address[] ccRecipients = sentMessage.getRecipients(Message.RecipientType.CC);
        assertEquals(1, ccRecipients.length);
        assertEquals("single-cc@company.com", ccRecipients[0].toString());

        Address[] bccRecipients = sentMessage.getRecipients(Message.RecipientType.BCC);
        assertEquals(1, bccRecipients.length);
        assertEquals("single-bcc@company.com", bccRecipients[0].toString());
    }
}

