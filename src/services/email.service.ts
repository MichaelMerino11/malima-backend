import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const enviarCorreoRestablecimiento = async (
  email: string,
  nombre: string,
  token: string,
): Promise<boolean> => {
  try {
    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error("FRONTEND_URL no está configurado");
    }

    const nombreSeguro = escapeHtml(nombre || "Usuario");

    const url =
      `${frontendUrl.replace(/\/$/, "")}` +
      `/restablecer-password?token=${encodeURIComponent(token)}`;

    const from =
      process.env.RESEND_FROM || "Grupo Malima <onboarding@resend.dev>";

    const logoUrl = process.env.EMAIL_LOGO_URL;

    const html = `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />

    <title>
      Restablecer contraseña - Grupo Malima
    </title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f4f6f9;
      font-family: Arial, Helvetica, sans-serif;
      color: #252a34;
    "
  >
    <div
      style="
        display: none;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        color: transparent;
      "
    >
      Recibimos una solicitud para restablecer
      la contraseña de tu cuenta de Grupo Malima.
    </div>

    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="
        width: 100%;
        background-color: #f4f6f9;
      "
    >
      <tr>
        <td
          align="center"
          style="
            padding: 36px 16px;
          "
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width: 100%;
              max-width: 600px;
            "
          >
            <tr>
              <td
                align="center"
                style="
                  padding-bottom: 22px;
                "
              >
                ${
                  logoUrl
                    ? `
                      <img
                        src="${logoUrl}"
                        alt="Grupo Malima"
                        width="150"
                        style="
                          display: block;
                          width: 150px;
                          max-width: 150px;
                          height: auto;
                          border: 0;
                        "
                      />
                    `
                    : `
                      <div
                        style="
                          font-size: 21px;
                          line-height: 28px;
                          font-weight: 700;
                          color: #173f9f;
                        "
                      >
                        Grupo Malima
                      </div>

                      <div
                        style="
                          margin-top: 3px;
                          font-size: 12px;
                          line-height: 18px;
                          color: #7a8392;
                        "
                      >
                        Sistema de Invernaderos
                      </div>
                    `
                }
              </td>
            </tr>

            <tr>
              <td>
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width: 100%;
                    background-color: #ffffff;
                    border: 1px solid #e3e7ee;
                    border-radius: 18px;
                    overflow: hidden;
                    box-shadow:
                      0 8px 30px
                      rgba(23, 63, 159, 0.06);
                  "
                >
                  <tr>
                    <td
                      style="
                        height: 6px;
                        background-color: #173f9f;
                        font-size: 0;
                        line-height: 0;
                      "
                    >
                      &nbsp;
                    </td>
                  </tr>

                  <tr>
                    <td
                      align="center"
                      style="
                        padding:
                          34px
                          38px
                          12px;
                      "
                    >
                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>
                          <td
                            align="center"
                            valign="middle"
                            style="
                              width: 64px;
                              height: 64px;
                              border-radius: 18px;
                              background-color: #edf2ff;
                              color: #173f9f;
                              font-size: 29px;
                              font-weight: 700;
                            "
                          >
                            &#128274;
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td
                      align="center"
                      style="
                        padding:
                          8px
                          38px
                          0;
                      "
                    >
                      <div
                        style="
                          margin-bottom: 7px;
                          font-size: 11px;
                          line-height: 16px;
                          font-weight: 700;
                          letter-spacing: 1px;
                          text-transform: uppercase;
                          color: #173f9f;
                        "
                      >
                        Seguridad de la cuenta
                      </div>

                      <h1
                        style="
                          margin: 0;
                          font-size: 24px;
                          line-height: 31px;
                          font-weight: 700;
                          color: #20242c;
                        "
                      >
                        Restablece tu contraseña
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:
                          24px
                          38px
                          0;
                        font-size: 15px;
                        line-height: 24px;
                        color: #545c69;
                      "
                    >
                      Hola
                      <strong
                        style="
                          color: #252a34;
                        "
                      >
                        ${nombreSeguro}
                      </strong>,
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:
                          8px
                          38px
                          0;
                        font-size: 15px;
                        line-height: 24px;
                        color: #545c69;
                      "
                    >
                      Recibimos una solicitud para
                      restablecer la contraseña de tu
                      cuenta en el
                      <strong
                        style="
                          color: #252a34;
                        "
                      >
                        Sistema de Invernaderos de
                        Grupo Malima
                      </strong>.
                    </td>
                  </tr>

                  <tr>
                    <td
                      align="center"
                      style="
                        padding:
                          28px
                          38px
                          24px;
                      "
                    >
                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>
                          <td
                            align="center"
                            bgcolor="#173f9f"
                            style="
                              border-radius: 10px;
                            "
                          >
                            <a
                              href="${url}"
                              target="_blank"
                              style="
                                display: inline-block;
                                padding:
                                  14px
                                  28px;
                                border-radius: 10px;
                                background-color: #173f9f;
                                color: #ffffff;
                                font-size: 14px;
                                line-height: 20px;
                                font-weight: 700;
                                text-decoration: none;
                              "
                            >
                              Restablecer contraseña
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:
                          0
                          38px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          width: 100%;
                          background-color: #fff8e9;
                          border: 1px solid #f4dfaf;
                          border-radius: 12px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding:
                                13px
                                14px;
                            "
                          >
                            <table
                              role="presentation"
                              width="100%"
                              cellspacing="0"
                              cellpadding="0"
                              border="0"
                            >
                              <tr>
                                <td
                                  width="30"
                                  valign="top"
                                  style="
                                    font-size: 18px;
                                    line-height: 22px;
                                  "
                                >
                                  &#9201;
                                </td>

                                <td
                                  style="
                                    font-size: 13px;
                                    line-height: 20px;
                                    color: #6d5a2c;
                                  "
                                >
                                  <strong>
                                    Este enlace expira
                                    en 1 hora.
                                  </strong>

                                  Después de ese tiempo
                                  deberás solicitar uno
                                  nuevo.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:
                          24px
                          38px
                          0;
                        font-size: 13px;
                        line-height: 21px;
                        color: #747c88;
                      "
                    >
                      Si el botón no funciona, copia
                      y pega el siguiente enlace en
                      tu navegador:
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:
                          8px
                          38px
                          0;
                      "
                    >
                      <div
                        style="
                          padding:
                            11px
                            12px;
                          border-radius: 9px;
                          background-color: #f5f7fa;
                          border: 1px solid #e7eaf0;
                          font-size: 11px;
                          line-height: 18px;
                          word-break: break-all;
                          color: #667085;
                        "
                      >
                        <a
                          href="${url}"
                          target="_blank"
                          style="
                            color: #173f9f;
                            text-decoration: none;
                          "
                        >
                          ${url}
                        </a>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:
                          26px
                          38px
                          0;
                      "
                    >
                      <div
                        style="
                          height: 1px;
                          background-color: #eceef2;
                        "
                      >
                        &nbsp;
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:
                          21px
                          38px
                          30px;
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>
                          <td
                            width="34"
                            valign="top"
                          >
                            <div
                              style="
                                width: 28px;
                                height: 28px;
                                line-height: 28px;
                                text-align: center;
                                border-radius: 8px;
                                background-color: #edf7ef;
                                color: #27883b;
                                font-size: 14px;
                              "
                            >
                              &#128737;
                            </div>
                          </td>

                          <td
                            style="
                              padding-left: 4px;
                              font-size: 12px;
                              line-height: 19px;
                              color: #7b8490;
                            "
                          >
                            <strong
                              style="
                                display: block;
                                margin-bottom: 2px;
                                color: #535b67;
                              "
                            >
                              ¿No solicitaste este cambio?
                            </strong>

                            Puedes ignorar este correo.
                            Tu contraseña actual seguirá
                            funcionando y no se realizará
                            ningún cambio en tu cuenta.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="
                  padding:
                    22px
                    18px
                    0;
                "
              >
                <div
                  style="
                    font-size: 12px;
                    line-height: 19px;
                    color: #9299a5;
                  "
                >
                  Grupo Malima · Sistema de Invernaderos
                </div>

                <div
                  style="
                    margin-top: 5px;
                    font-size: 11px;
                    line-height: 18px;
                    color: #abb0b9;
                  "
                >
                  Este es un mensaje automático.
                  Por favor, no respondas a este correo.
                </div>

                <div
                  style="
                    margin-top: 8px;
                    font-size: 11px;
                    line-height: 18px;
                    color: #abb0b9;
                  "
                >
                  Tecnología desarrollada por
                  <strong>
                    Maintronic
                  </strong>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

    const text = `
Hola ${nombre || "Usuario"},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en el Sistema de Invernaderos de Grupo Malima.

Para crear una nueva contraseña, abre el siguiente enlace:

${url}

Este enlace expira en 1 hora.

Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá funcionando.

Grupo Malima
Sistema de Invernaderos

Tecnología desarrollada por Maintronic
    `.trim();

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Restablece tu contraseña | Grupo Malima",
      html,
      text,
    });

    if (error) {
      console.error("Resend no pudo enviar el correo:", error);

      return false;
    }

    return true;
  } catch (error) {
    console.error("Error enviando correo de restablecimiento:", error);

    return false;
  }
};