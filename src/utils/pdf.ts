import {
  asPDFName,
  degrees,
  drawImage,
  drawText,
  PDFButton,
  PDFCheckBox,
  PDFContentStream,
  PDFDropdown,
  PDFField,
  PDFFont,
  PDFImage,
  PDFOperator,
  PDFOperatorNames,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateDegrees,
  translate,
} from "@cantoo/pdf-lib";

export function getFieldTypeName(
  field: PDFField,
):
  | "PDFTextField"
  | "PDFSignature"
  | "PDFCheckBox"
  | "PDFButton"
  | "PDFOptionList"
  | "PDFRadioGroup"
  | "PDFDropdown"
  | undefined {
  if (field instanceof PDFTextField) {
    return "PDFTextField";
  } else if (field instanceof PDFSignature) {
    return "PDFSignature";
  } else if (field instanceof PDFCheckBox) {
    return "PDFCheckBox";
  } else if (field instanceof PDFButton) {
    return "PDFButton";
  } else if (field instanceof PDFOptionList) {
    return "PDFOptionList";
  } else if (field instanceof PDFRadioGroup) {
    return "PDFRadioGroup";
  } else if (field instanceof PDFDropdown) {
    return "PDFDropdown";
  } else {
    return undefined;
  }
}

// function signatureAppearanceStream(
//   image: PDFImage,
//   text: string,
//   rotation: number,
//   width: number,
//   height: number,
//   font: PDFFont,
//   size: number,
// ) {
//   const dict = image.doc.context.obj({
//     Type: "XObject",
//     Subtype: "Form",
//     FormType: 1,
//     BBox: [0, 0, width, height],
//     Resources: {
//       XObject: { Image: image.ref },
//       Font: { F0: font.ref },
//     },
//   });
//   var operators = [
//     rotateDegrees(rotation),
//     translate(0, rotation % 90 === 0 ? -width : 0),
//     ...drawImage("Image", {
//       x: 0,
//       y: width, //y = 0 is width for me
//       width: width,
//       height: height,
//       rotate: degrees(0),
//       xSkew: degrees(0),
//       ySkew: degrees(0),
//     }),
//     PDFOperator.of(PDFOperatorNames.BeginMarkedContent, [
//       asPDFName("Tx"),
//     ]),
//     pushGraphicsState(),
//     ...drawText(font.encodeText(text), {
//       color: rgb(0, 0, 0),
//       font: "F0",
//       size: size,
//       rotate: degrees(0),
//       xSkew: degrees(0),
//       ySkew: degrees(0),
//       x: 0,
//       y: width, //y = 0 is width for me
//     }),
//     popGraphicsState(),
//     PDFOperator.of(PDFOperatorNames.EndMarkedContent),
//   ];
//   const stream = PDFContentStream.of(
//     dict,
//     operators,
//     false,
//   );
//   return image.doc.context.register(stream);
// }

export function fillTextField(
  field: PDFTextField,
  text: string,
) {
  field.setText(text);
  console.log(
    "field",
    `"${field.getName()}"`,
    "filling with text",
    `"${field.getText()}"`,
  );
}

export async function fillSignature(
  field: PDFSignature,
  text: string,
  imageDir: FileSystemDirectoryHandle | null,
  customFont: PDFFont | null,
) {
  if (text && text.startsWith("file://")) {
    const filename = text.replace(/^file:\/\//, "");
    console.log(`trying to get file ${filename}`);
    if (!imageDir) {
      throw Error(`imgDir is required`);
    }
    const imgHandle =
      await imageDir.getFileHandle(filename);
    if (!imgHandle) {
      throw Error(
        `${filename} not found in ${imageDir.name}`,
      );
    }

    const file = await imgHandle.getFile();
    let pdfLibSigImg: PDFImage | undefined;
    if (file.type === "image/jpeg") {
      pdfLibSigImg = await field.doc.embedJpg(
        await file.arrayBuffer(),
      );
    } else if (file.type === "image/png") {
      pdfLibSigImg = await field.doc.embedPng(
        await file.arrayBuffer(),
      );
    }

    if (!pdfLibSigImg) {
      throw Error(`${file.type} is not support`);
    }

    field.acroField.getWidgets().forEach((widget) => {
      console.log(
        `drawing ${file.name} to field ${field.getName()}`,
        `Rect: ${JSON.stringify(widget.getRectangle())}`,
      );
      const { context } = widget.dict;
      const { width, height } = widget.getRectangle();

      const appearance = [
        ...drawImage(filename, {
          x: 0,
          y: 0,
          width: width,
          height: height,
          rotate: degrees(0),
          xSkew: degrees(0),
          ySkew: degrees(0),
        }),
      ];

      const stream = context.formXObject(appearance, {
        Resources: {
          XObject: {
            [filename]: pdfLibSigImg.ref,
          },
        },
        BBox: context.obj([0, 0, width, height]),
        Matrix: context.obj([1, 0, 0, 1, 0, 0]),
      });
      const streamRef = context.register(stream);

      widget.setNormalAppearance(streamRef);
    });
  } else {
    if (!customFont) {
      throw Error(`customFont is required`);
    }
    field.acroField.getWidgets().forEach((widget) => {
      const { context } = widget.dict;
      const { width, height } = widget.getRectangle();
      console.log(
        `drawing text "${text}" to field ${field.getName()}`,
        `Rect: ${JSON.stringify(widget.getRectangle())}`,
      );
      const fontSize = customFont.sizeAtHeight(height);
      const calcWidth = customFont.widthOfTextAtSize(
        text,
        fontSize,
      );
      const ratio = width / calcWidth;
      const calcSize = Math.min(fontSize, fontSize * ratio);
      const fixedWidth = customFont.widthOfTextAtSize(
        text,
        calcSize,
      );

      const appearance = [
        PDFOperator.of(
          PDFOperatorNames.BeginMarkedContent,
          [asPDFName("Tx")],
        ),
        pushGraphicsState(),
        ...drawText(customFont.encodeText(text), {
          x: (width - fixedWidth) / 2,
          y: (height - calcSize) / 2,
          color: rgb(0, 0, 0),
          font: customFont.name,
          size: calcSize,
          rotate: degrees(0),
          xSkew: degrees(0),
          ySkew: degrees(0),
        }),
        popGraphicsState(),
        PDFOperator.of(PDFOperatorNames.EndMarkedContent),
      ];
      const stream = context.contentStream(appearance, {
        BBox: context.obj([0, 0, width, height]),
        Resources: {
          Font: {
            [customFont.name]: customFont.ref,
          },
        },
        Matrix: context.obj([1, 0, 0, 1, 0, 0]),
      });

      const streamRef = context.register(stream);

      widget.setNormalAppearance(streamRef);

      // console.warn(
      //   `sign ${field.getName()} with text is not supported yet`,
      // );
    });
  }
}

export function fillCheckBox(
  field: PDFCheckBox,
  text: string,
) {
  if (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "是"
  ) {
    field.check();
  } else {
    field.uncheck();
  }
}
