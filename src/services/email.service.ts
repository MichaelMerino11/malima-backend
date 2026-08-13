import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const enviarCorreoRestablecimiento = async (
  email: string,
  nombre: string,
  token: string,
): Promise<boolean> => {
  try {
    const url = `${process.env.FRONTEND_URL}/restablecer-password?token=${token}`;

    await resend.emails.send({
      from: "Grupo Malima <onboarding@resend.dev>",
      to: email,
      subject: "Restablecer contraseña — Grupo Malima",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #1A3A8F;">Grupo Malima</h2>
          <p>Hola <b>${nombre}</b>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente botón para continuar:</p>
          <a href="${url}" style="
            display: inline-block;
            background-color: #1A3A8F;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            margin: 16px 0;
          ">Restablecer contraseña</a>
          <p style="color: #666; font-size: 13px;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Desarrollado por Maintronic</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Error enviando correo:", error);
    return false;
  }
};
